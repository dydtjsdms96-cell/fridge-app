import Link from "next/link";
import { ChefHat, Home, Package2, Settings, ShoppingBag } from "lucide-react";

export type AppTab = "home" | "fridge" | "meal" | "list" | "settings";

const TABS: {
  id: AppTab;
  label: string;
  icon: typeof Home;
  href: string | null;
}[] = [
  { id: "home", label: "홈", icon: Home, href: "/" },
  { id: "fridge", label: "냉장고", icon: Package2, href: "/fridge" },
  { id: "meal", label: "식단", icon: ChefHat, href: "/meal" },
  { id: "list", label: "쇼핑", icon: ShoppingBag, href: "/shopping" },
  { id: "settings", label: "설정", icon: Settings, href: "/settings" },
];

type BottomTabBarProps = {
  activeTab: AppTab;
};

export function BottomTabBar({ activeTab }: BottomTabBarProps) {
  return (
    <nav className="flex h-[82px] w-full shrink-0 items-start border-t border-border bg-card px-1 pt-3 pb-[env(safe-area-inset-bottom)]">
      {TABS.map(({ id, label, icon: Icon, href }) => {
        const active = activeTab === id;
        const className = "flex flex-1 flex-col items-center gap-[5px]";
        const content = (
          <>
            <div
              className={`flex size-8 items-center justify-center rounded-[20px] ${
                active ? "bg-secondary" : "bg-transparent"
              }`}
            >
              <Icon
                size={19}
                className={active ? "text-primary" : "text-muted-foreground"}
              />
            </div>
            <span
              className={`text-[9px] font-medium leading-[9px] ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </>
        );

        if (!href) {
          return (
            <div key={id} className={`${className} opacity-50`}>
              {content}
            </div>
          );
        }

        return (
          <Link
            key={id}
            href={href}
            className={className}
            aria-current={active ? "page" : undefined}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
