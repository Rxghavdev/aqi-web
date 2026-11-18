import { Suspense } from "react";
import { Logo } from "@/components/brand/Logo";
import { SearchLauncher } from "@/components/search/SearchLauncher";
import { HeaderScroll } from "./HeaderScroll";
import { DesktopNav, MobileNav } from "./Nav";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <header id="site-header" className="site-header">
      <div className="site-header-inner">
        <Logo />
        <Suspense fallback={null}>
          <DesktopNav />
        </Suspense>
        <div className="site-actions">
          <SearchLauncher />
          <ThemeToggle />
          <Suspense fallback={null}>
            <MobileNav />
          </Suspense>
        </div>
      </div>
      <HeaderScroll targetId="site-header" />
    </header>
  );
}
