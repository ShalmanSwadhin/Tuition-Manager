import { useAuth } from "../context/AuthContext";

export default function Settings() {
  const { user } = useAuth();
  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Settings</h1>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-500">Signed in as</p>
        <p className="font-medium text-slate-900">{user?.name}</p>
        <p className="text-sm text-slate-500">{user?.email}</p>
      </div>
      <p className="text-xs text-slate-400">
        This account is the only admin account for this app. To change the email or password, update it in your
        database or re-run the seed script with new values.
      </p>
    </div>
  );
}
