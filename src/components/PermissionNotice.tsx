import Link from 'next/link';

type Kind = 'login' | 'member' | 'staff';

export default function PermissionNotice({ kind }: { kind: Kind }) {
  if (kind === 'login') {
    return (
      <div>
        <div className="text-sm font-semibold text-white">Sign in required</div>
        <div className="mt-1 text-sm text-white/70">
          Please log in with VATSIM to access this tool.
        </div>
        <div className="mt-3">
          <a href="/api/auth/login" className="ui-btn ui-btn--primary">
            Login with VATSIM
          </a>
        </div>
      </div>
    );
  }

  if (kind === 'member') {
    return (
      <div>
        <div className="text-sm font-semibold text-white">Roster access required</div>
        <div className="mt-1 text-sm text-white/70">
          This section is only available to ZOB home or visiting controllers.
        </div>
        <div className="mt-2 text-xs text-white/60">
          If your roster status looks wrong, contact staff.
        </div>
      </div>
    );
  }

  // staff
  return (
    <div>
      <div className="text-sm font-semibold text-white">Staff permission required</div>
      <div className="mt-1 text-sm text-white/70">You don’t have the required role to access this page.</div>
      <div className="mt-3">
        <Link href="/" className="ui-btn">Return home</Link>
      </div>
    </div>
  );
}
