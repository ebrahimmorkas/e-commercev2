import { LANDMARKS, TEMPLE_SHOW_FROM_DEG, TEMPLE_FULL_AT_DEG } from '../constants';

const toDeg = (rad) => (rad * 180) / Math.PI;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (v, k) => ({ x: v.x * k, y: v.y * k });
const length = (v) => Math.hypot(v.x, v.y);

// The frame front is never drawn narrower than this share of its real width,
// so a strongly turned head can't squash it to nothing.
const MIN_TURN_COS = 0.35;

/**
 * How far the head is turned left/right, from the depth of the face outline
 * on either side (MediaPipe z uses roughly the same scale as x). Positive =
 * the image-right side is farther from the camera, i.e. the image-left side
 * of the face is the near side.
 */
const getHeadTurn = (landmarks, width, height) => {
  const left = landmarks[LANDMARKS.LEFT_FACE_EDGE];
  const right = landmarks[LANDMARKS.RIGHT_FACE_EDGE];
  const across = Math.hypot((right.x - left.x) * width, (right.y - left.y) * height);
  return Math.atan2((right.z - left.z) * width, across);
};

/**
 * Canvas transform for one half of the frame image: its lens centre goes on
 * the pupil and its bridge end on the nose bridge, so with a turned head the
 * near half comes out wider than the far one (perspective) while the height
 * keeps the head's real size.
 */
const getHalfTransform = ({ bridge, pupil, isLeftHalf, rollAxis, trueScale, image, frame }) => {
  const srcWidth = image.naturalWidth;
  const srcHeight = image.naturalHeight;
  // Bridge (50%) to lens centre (25% / 75%) is a quarter of the image width;
  // widthScale / 2 keeps the lens centres slightly outside the pupils.
  const towardRight = isLeftHalf ? sub(bridge, pupil) : sub(pupil, bridge);
  const xAxis = scale(towardRight, (frame.widthScale / 2) / (srcWidth / 4));
  const yAxis = scale(rollAxis.y, trueScale);
  const origin = sub(sub(bridge, scale(xAxis, srcWidth / 2)), scale(yAxis, srcHeight * frame.anchorY));
  return { xAxis, yAxis, origin };
};

// Maps a point in frame-image pixels through a half transform.
const project = ({ xAxis, yAxis, origin }, u, v) => add(origin, add(scale(xAxis, u), scale(yAxis, v)));

const drawHalf = (ctx, image, transform, isLeftHalf) => {
  const { xAxis, yAxis, origin } = transform;
  const halfWidth = image.naturalWidth / 2;
  const sourceX = isLeftHalf ? 0 : halfWidth;
  // Each half runs 1px past the middle so no seam shows at the bridge.
  const overlap = isLeftHalf ? 0 : 1;
  ctx.save();
  ctx.transform(xAxis.x, xAxis.y, yAxis.x, yAxis.y, origin.x, origin.y);
  ctx.drawImage(image, sourceX - overlap, 0, halfWidth + 1, image.naturalHeight, sourceX - overlap, 0, halfWidth + 1, image.naturalHeight);
  ctx.restore();
};

// The side arm: from the hinge back to just past the front of the ear,
// tapering slightly, in the frame's own colour(s).
const drawTemple = (ctx, { hinge, earEnd, thickness, colors, opacity }) => {
  const along = sub(earEnd, hinge);
  const len = length(along);
  if (len < 2) return;
  const normal = { x: -along.y / len, y: along.x / len };
  const startHalf = thickness / 2;
  const endHalf = (thickness * 0.75) / 2;

  let fill = colors[0];
  if (colors.length > 1) {
    fill = ctx.createLinearGradient(hinge.x, hinge.y, earEnd.x, earEnd.y);
    colors.forEach((color, index) => fill.addColorStop(index / (colors.length - 1), color));
  }

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(hinge.x + normal.x * startHalf, hinge.y + normal.y * startHalf);
  ctx.lineTo(earEnd.x + normal.x * endHalf, earEnd.y + normal.y * endHalf);
  ctx.arc(earEnd.x, earEnd.y, endHalf, Math.atan2(normal.y, normal.x), Math.atan2(-normal.y, -normal.x));
  ctx.lineTo(hinge.x - normal.x * startHalf, hinge.y - normal.y * startHalf);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

/**
 * Draws a frame over the face found in `landmarks` (normalised 0..1
 * MediaPipe points). The canvas must already hold the photo / video frame.
 *  - Size comes from the distance between the pupils, corrected for how far
 *    the head is turned, and the frame follows the head tilt.
 *  - With the head turned, the front narrows in perspective and the near-side
 *    temple appears, running back to the ear; the far one stays hidden
 *    behind the head.
 */
export const drawSpectacles = (ctx, landmarks, frameImage, frame) => {
  if (!landmarks || landmarks.length <= LANDMARKS.RIGHT_IRIS) return;
  if (!frameImage?.complete || !frameImage.naturalWidth) return;

  const { width, height } = ctx.canvas;
  const toPx = (index) => ({ x: landmarks[index].x * width, y: landmarks[index].y * height });

  const leftPupil = toPx(LANDMARKS.LEFT_IRIS);
  const rightPupil = toPx(LANDMARKS.RIGHT_IRIS);
  const pupilLine = sub(rightPupil, leftPupil);
  const pupilDistance = length(pupilLine);
  if (pupilDistance < 2) return;

  // Head tilt (roll): unit vectors along and across the pupil line.
  const along = scale(pupilLine, 1 / pupilDistance);
  const rollAxis = { x: along, y: { x: -along.y, y: along.x } };

  // Head turn (yaw): the pupils look closer together than they really are.
  const turn = getHeadTurn(landmarks, width, height);
  const turnCos = Math.max(Math.cos(turn), MIN_TURN_COS);
  const trueScale = ((pupilDistance / turnCos) * frame.widthScale) / frameImage.naturalWidth;

  // The nose bridge, moved onto the pupil line - where the two halves meet.
  const noseBridge = toPx(LANDMARKS.NOSE_BRIDGE);
  const bridgeOffset = Math.min(Math.max(
    (noseBridge.x - leftPupil.x) * along.x + (noseBridge.y - leftPupil.y) * along.y,
    pupilDistance * 0.15), pupilDistance * 0.85);
  const bridge = add(leftPupil, scale(along, bridgeOffset));

  const common = { bridge, rollAxis, trueScale, image: frameImage, frame };
  const leftHalf = getHalfTransform({ ...common, pupil: leftPupil, isLeftHalf: true });
  const rightHalf = getHalfTransform({ ...common, pupil: rightPupil, isLeftHalf: false });

  // Near-side temple, drawn first so the front covers the hinge.
  const turnDeg = Math.abs(toDeg(turn));
  const opacity = Math.min(Math.max((turnDeg - TEMPLE_SHOW_FROM_DEG) / (TEMPLE_FULL_AT_DEG - TEMPLE_SHOW_FROM_DEG), 0), 1);
  if (opacity > 0 && frame.temple) {
    const nearIsLeft = turn > 0;
    const hingeY = frameImage.naturalHeight * frame.hingeY;
    const hinge = nearIsLeft
      ? project(leftHalf, 0, hingeY)
      : project(rightHalf, frameImage.naturalWidth, hingeY);
    // Face outline in front of the ear: between the ear top and the face edge.
    const earTop = toPx(nearIsLeft ? LANDMARKS.LEFT_EAR_TOP : LANDMARKS.RIGHT_EAR_TOP);
    const faceEdge = toPx(nearIsLeft ? LANDMARKS.LEFT_FACE_EDGE : LANDMARKS.RIGHT_FACE_EDGE);
    const earFront = scale(add(earTop, faceEdge), 0.5);
    // Carry on 20% past it so the arm reaches over the ear.
    const earEnd = add(earFront, scale(sub(earFront, hinge), 0.2));
    drawTemple(ctx, {
      hinge,
      earEnd,
      thickness: frameImage.naturalHeight * frame.temple.thickness * trueScale,
      colors: frame.temple.colors,
      opacity,
    });
  }

  drawHalf(ctx, frameImage, leftHalf, true);
  drawHalf(ctx, frameImage, rightHalf, false);
};

// Preloads the frame images so switching frames never flickers.
export const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
