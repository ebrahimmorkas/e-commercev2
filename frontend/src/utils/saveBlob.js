/**
 * Saves a Blob to the user's disk under the given filename, via a temporary <a download>.
 * (Nothing is navigated, so a failed/blocked download never takes the user off the page.)
 */
export const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick - some browsers cancel the download if the URL disappears synchronously.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default saveBlob;
