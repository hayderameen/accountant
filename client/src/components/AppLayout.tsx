import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col">
      <header className="border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-400">Accountant</p>
            <p className="font-medium">{user?.name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-zinc-400 hover:text-zinc-200"
          >
            Logout
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          <Link to="/accounts" className="text-zinc-400 hover:text-zinc-200">
            Accounts
          </Link>
          <Link to="/categories" className="text-zinc-400 hover:text-zinc-200">
            Categories
          </Link>
          <Link to="/loans" className="text-zinc-400 hover:text-zinc-200">
            Loans
          </Link>
          <Link to="/automations" className="text-zinc-400 hover:text-zinc-200">
            Automations
          </Link>
          <Link to="/import" className="text-emerald-400 hover:text-emerald-300">
            Import
          </Link>
          <Link to="/settings" className="text-zinc-400 hover:text-zinc-200">
            Settings
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 py-4">
        <Outlet />
      </main>

      <nav className="grid grid-cols-3 border-t border-zinc-800 text-sm">
        <Link to="/" className="py-3 text-center hover:bg-zinc-900">
          Dashboard
        </Link>
        <Link to="/transactions" className="py-3 text-center hover:bg-zinc-900">
          Transactions
        </Link>
        <Link to="/add" className="py-3 text-center hover:bg-zinc-900">
          Add
        </Link>
      </nav>
    </div>
  );
}
