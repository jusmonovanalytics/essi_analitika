import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Truck, Users } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/orders', label: 'Buyurtmalar', icon: ShoppingCart },
  { path: '/delivery', label: 'Yetkazuvchilar', icon: Truck },
  { path: '/clients', label: 'Mijozlar', icon: Users },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-60 bg-gray-900 text-white flex flex-col shadow-xl flex-shrink-0">
        <div className="px-6 py-5 border-b border-gray-700">
          <h1 className="text-lg font-bold text-white">ESSI</h1>
          <p className="text-xs text-gray-400 mt-0.5">Milkolino Products</p>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-6 py-4 border-t border-gray-700">
          <p className="text-xs text-gray-500">OOO Milkolino Products</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
