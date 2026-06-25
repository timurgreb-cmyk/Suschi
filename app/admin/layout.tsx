import { createClient } from "@supabase/supabase-js";
import { createClient as createSessionClient } from "@/utils/supabase/server";
import { Clock, Users, LayoutDashboard, MapPin, LogOut, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { logout } from "@/app/actions/auth";
import AdminMobileMenu from "@/components/AdminMobileMenu";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionClient = createSessionClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let adminName = "Администратор";
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    if (data?.full_name) adminName = data.full_name;
  }

  const navItems = [
    { name: "Дашборд", href: "/admin", icon: LayoutDashboard },
    { name: "Сотрудники", href: "/admin/employees", icon: Users },
    { name: "Журнал", href: "/admin/attendance", icon: Clock },
    { name: "Табель", href: "/admin/timesheet", icon: Clock },
    { name: "Штрафы", href: "/admin/fines", icon: AlertTriangle },
    { name: "Локации", href: "/admin/locations", icon: MapPin },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      <AdminMobileMenu adminName={adminName} />
      
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">Sushi Control</h1>
        </div>
        
        <div className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center px-2 py-2.5 text-sm font-medium rounded-lg text-gray-700 hover:text-primary hover:bg-primary/5 transition-colors group"
            >
              <item.icon className="mr-3 h-5 w-5 text-gray-400 group-hover:text-primary" />
              {item.name}
            </Link>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center mb-4 px-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-medium text-sm">
                {adminName.charAt(0)}
              </span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-700 truncate w-32">
                {adminName}
              </p>
            </div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center px-2 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Выйти
            </button>
          </form>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header could go here if needed, but admin is desktop focused */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
