import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-xl font-semibold text-stone-900">Not found</h1>
      <p className="mt-2 text-sm text-stone-500">That record doesn&apos;t exist or was deleted.</p>
      <Link href="/" className="btn mt-4">Back to Today</Link>
    </div>
  );
}
