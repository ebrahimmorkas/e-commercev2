import { ORDER_MODULE } from '../constants';

/**
 * Order-step assignment helpers for step-wise order templates
 * (isDifferentEmailTemplatesForOrderStepsOn). These mirror the backend's
 * emailTemplateMasterService.planAssignment so the page can show the
 * "these steps belong to other templates" confirmation BEFORE saving - the
 * backend still re-checks everything and is the source of truth.
 *
 * Assignment entries: { module, templateId, stepCodes }. Empty stepCodes =
 * a "whole module" entry, which in step-wise mode covers every step no other
 * template has.
 */

// Special picks shown at the top of the steps dropdown. Each one excludes
// every other pick (choosing a single step deselects them, and vice versa).
export const ALL_STEPS = '__ALL_STEPS__';
export const REMAINING_STEPS = '__REMAINING_STEPS__';
const SPECIAL_PICKS = [ALL_STEPS, REMAINING_STEPS];

export const isStepEntry = (assignment) => Array.isArray(assignment?.stepCodes) && assignment.stepCodes.length > 0;

/** Dropdown options: the two special picks, then the vendor's steps. */
export const buildStepDropdownOptions = (stepOptions) => [
  { value: ALL_STEPS, label: 'All steps' },
  { value: REMAINING_STEPS, label: 'Remaining steps (not used by another template)' },
  ...stepOptions.map((step) => ({ value: step.code, label: step.name })),
];

/**
 * Next dropdown value after the vendor clicked `clicked`, enforcing that a
 * special pick is always on its own.
 */
export const applyStepPick = (nextValue, clicked) => {
  if (SPECIAL_PICKS.includes(clicked) && nextValue.includes(clicked)) return [clicked];
  return nextValue.filter((value) => !SPECIAL_PICKS.includes(value));
};

/** Initial dropdown value for a template: its own steps, else "All steps". */
export const initialStepPicks = (assignment) => (isStepEntry(assignment) ? [...assignment.stepCodes] : [ALL_STEPS]);

/** API fields for a dropdown value: { stepSelection, stepCodes }. */
export const toStepRequest = (picks) => {
  if (picks.includes(ALL_STEPS)) return { stepSelection: 'ALL', stepCodes: [] };
  if (picks.includes(REMAINING_STEPS)) return { stepSelection: 'REMAINING', stepCodes: [] };
  return { stepSelection: 'CUSTOM', stepCodes: picks };
};

/** Inverse of toStepRequest - the dropdown picks behind a request. */
export const picksFromRequest = ({ stepSelection, stepCodes = [] }) => {
  if (stepSelection === 'ALL') return [ALL_STEPS];
  if (stepSelection === 'REMAINING') return [REMAINING_STEPS];
  return stepCodes;
};

// Which OTHER template currently sends each step (a step entry listing it,
// else another template's whole-module Order entry).
const buildStepCoverage = (assignments, templateId, stepOptions) => {
  const orderEntries = assignments.filter((a) => a.module === ORDER_MODULE && a.templateId !== templateId);
  const wholeModuleEntry = orderEntries.find((a) => !isStepEntry(a));
  const coverage = {};
  stepOptions.forEach(({ code }) => {
    const holder = orderEntries.find((a) => isStepEntry(a) && a.stepCodes.includes(code)) || wholeModuleEntry;
    if (holder) coverage[code] = holder.templateId;
  });
  return coverage;
};

/**
 * Other templates that would lose something if `templateId` (null for a new
 * template) were assigned to `module` with the given step picks.
 * Returns [{ templateName, stepNames: string[] }] - stepNames is empty for a
 * whole-module conflict (step-wise off, or a non-Order module).
 */
export const findAssignmentConflicts = ({ assignments, templates, templateId, module, picks, isStepWiseOn, stepOptions }) => {
  const nameOf = (id) => templates.find((t) => t._id === id)?.templateName || 'another template';

  if (!(isStepWiseOn && module === ORDER_MODULE)) {
    const holder = assignments.find((a) => a.module === module && !isStepEntry(a) && a.templateId !== templateId);
    return holder ? [{ templateName: nameOf(holder.templateId), stepNames: [] }] : [];
  }

  const coverage = buildStepCoverage(assignments, templateId, stepOptions);
  let codes;
  if (picks.includes(ALL_STEPS)) codes = stepOptions.map((s) => s.code);
  else if (picks.includes(REMAINING_STEPS)) codes = []; // by definition nobody else has them
  else codes = picks;

  const byTemplate = new Map();
  codes.forEach((code) => {
    const holderId = coverage[code];
    if (!holderId) return;
    const stepName = stepOptions.find((s) => s.code === code)?.name || code;
    byTemplate.set(holderId, [...(byTemplate.get(holderId) || []), stepName]);
  });
  return [...byTemplate.entries()].map(([id, stepNames]) => ({ templateName: nameOf(id), stepNames }));
};

/** Readable step names for an assignment entry, for the list's Order Steps column. */
export const describeAssignedSteps = (assignment, stepOptions) => {
  if (!assignment || assignment.module !== ORDER_MODULE) return null;
  if (!isStepEntry(assignment)) return 'All steps not assigned to another template';
  return assignment.stepCodes.map((code) => stepOptions.find((s) => s.code === code)?.name || code).join(', ');
};
