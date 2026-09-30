import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Not found</h1>
        <p className="mt-2 text-sm text-gray-600">This page does not exist, or you do not have access to it.</p>
        <Link href="/" className="mt-4 inline-block text-sm underline">Back to the overview</Link>
      </div>
    </main>
  );
}
