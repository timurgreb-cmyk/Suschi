"use client";

import { 
  ScanLine, 
  ClipboardCheck, 
  UtensilsCrossed, 
  TrendingUp, 
  Wallet, 
  UserCircle 
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentProfile } from "@/app/actions/auth";

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const data = await getCurrentProfile();
      setProfile(data);
    };
    fetchProfile();
  }, []);

  const pos = (profile?.position || "").toLowerCase();
  const isCashierOrWaiter = pos.includes("кассир") || pos.includes("официант");

  const tabs = [
    { name: "Чек-листы", href: "/app/checklists", icon: ClipboardCheck },
    isCashierOrWaiter
      ? { name: "Продажи", href: "/app/sales", icon: TrendingUp }
      : { name: "Кухня", href: "/app/kitchen", icon: UtensilsCrossed },
    { name: "Сканер", href: "/app/scan", icon: ScanLine, isCenter: true },
    { name: "Финансы", href: "/app/finance", icon: Wallet },
    { name: "Профиль", href: "/app/profile", icon: UserCircle },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#F3F4F6] relative">
      <main className="flex-1 overflow-y-auto pb-28 relative z-0">{children}</main>

      <nav className="fixed bottom-0 w-full z-50 px-3 pb-5 pt-2">
        <div className="max-w-md mx-auto bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-xl shadow-black/10 rounded-3xl px-2">
          <div className="flex justify-around items-center h-16 relative">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
              const isCenter = tab.isCenter;

              if (isCenter) {
                return (
                  <Link
                    key={tab.name}
                    href={tab.href}
                    className="relative -top-5 flex flex-col items-center group"
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 ${
                      isActive 
                        ? "bg-primary text-white shadow-primary/40 scale-105" 
                        : "bg-gray-900 text-white shadow-black/20 hover:scale-105 active:scale-95"
                    }`}>
                      <Icon className="w-7 h-7 stroke-[2.2px]" />
                    </div>
                    <span className="text-[10px] font-bold text-gray-700 mt-1">
                      {tab.name}
                    </span>
                  </Link>
                );
              }

              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className="relative flex flex-col items-center justify-center w-full h-full"
                >
                  <div className={`flex flex-col items-center justify-center transition-all duration-300 ${isActive ? '-translate-y-0.5' : ''}`}>
                    <Icon className={`w-5 h-5 mb-1 transition-colors duration-200 ${isActive ? "text-primary stroke-[2.5px]" : "text-gray-400"}`} />
                    <span className={`text-[10px] font-medium transition-colors duration-200 ${isActive ? "text-primary font-bold" : "text-gray-400"}`}>
                      {tab.name}
                    </span>
                  </div>
                  {isActive && (
                    <div className="absolute -bottom-1 w-8 h-1 bg-primary rounded-t-full shadow-[0_-2px_10px_rgba(37,99,235,0.5)]" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
