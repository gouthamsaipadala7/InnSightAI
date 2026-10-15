import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { PageTransition } from "./page-transition";
import { IdleLockscreen } from "./idle-lockscreen";
import { CommandPalette } from "./command-palette";

interface AppShellProps {
  role: "receptionist" | "manager";
  hotelName: string;
  name: string;
  children: React.ReactNode;
}

export function AppShell({ role, hotelName, name, children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar role={role} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar hotelName={hotelName} role={role} name={name} />
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <IdleLockscreen hotelName={hotelName} />
      <CommandPalette role={role} />
    </div>
  );
}