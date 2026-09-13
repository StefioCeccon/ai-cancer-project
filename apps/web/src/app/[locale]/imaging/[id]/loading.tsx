export default function ImagingStudyLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-500 text-sm">Loading imaging study…</p>
    </div>
  );
}
