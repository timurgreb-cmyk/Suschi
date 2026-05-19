"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Clock, MapPin, Menu, X, LogOut } from "lucide-react";

import { logout } from "@/app/actions/auth";

export default function AdminMobileMenu({ adminName }: { adminName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const navItems = [
    { name: "Дашборд", href: "/admin", icon: LayoutDashboard },
    { name: "Сотрудники", href: "/admin/employees", icon: Users },
    { name: "Журнал", href: "/admin/attendance", icon: Clock },
    { name: "Табель", href: "/admin/timesheet", icon: Clock },
    { name: "Локации", href: "/admin/locations", icon: MapPin },
  ];

  return (
    <div className="md:hidden">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 h-16 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Sushi Control</h1>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 -mr-2 text-gray-600 hover:text-primary transition-colors"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Full Screen Menu */}
      {isOpen && (
        <div className="fixed inset-0 top-16 bg-white z-40 flex flex-col h-[calc(100vh-4rem)]">
          <div className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center px-4 py-4 rounded-xl text-base font-medium transition-colors ${
                    isActive 
                      ? "bg-primary text-white" 
                      : "text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                  }`}
                >
                  <item.icon className={`mr-4 h-6 w-6 ${isActive ? "text-white" : "text-gray-400"}`} />
                  {item.name}
                </Link>
              );
            })}
          </div>

          <div className="p-6 border-t border-gray-200 bg-gray-50 mt-auto">
            <div className="flex items-center mb-6">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-bold text-lg">
                  {adminName.charAt(0)}
                </span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-gray-500">Администратор</p>
                <p className="text-base font-medium text-gray-900 truncate w-48">
                  {adminName}
                </p>
              </div>
            </div>
            
            <form action={logout}>
              <button
                type="submit"
                className="flex w-full items-center justify-center px-4 py-3 text-base font-medium text-red-600 bg-red-50 rounded-xl hover:bg-red-100 active:bg-red-200 transition-colors"
              >
                <LogOut className="mr-3 h-5 w-5" />
                Выйти
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
