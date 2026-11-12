const owner = (() => {
  try {
    let o = localStorage.getItem("chrono-owner");
    if (!o) { o = crypto.randomUUID(); localStorage.setItem("chrono-owner", o); }
    return o;
  } catch { return "anon"; }
})();
export { owner };
async function call(path, opts) {
  const r = await fetch("/api" + path, { headers: { "Content-Type": "application/json" }, ...opts });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Request failed");
  return j;
}
export const getCapsules = () => call("/capsules?owner=" + owner);
export const addCapsule = (b) => call("/capsules", { method: "POST", body: JSON.stringify({ ...b, owner }) });
export const getPredictions = () => call("/predictions");
export const addPrediction = (b) => call("/predictions", { method: "POST", body: JSON.stringify(b) });
export const getMemories = () => call("/memories");
export const addMemory = (b) => call("/memories", { method: "POST", body: JSON.stringify(b) });
