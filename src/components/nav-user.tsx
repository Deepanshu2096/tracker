import { ChevronsUpDown, LogOut } from "lucide-react"

import {
	Avatar,
	AvatarFallback,
} from "@/components/ui/avatar"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
// import { AccountDialog } from "./AccountDialog"
import { useAuth } from "@/hooks/useAuth.tsx"


export function NavUser() {
	const { isMobile } = useSidebar()
	const { user, signOut } = useAuth()

	return (
		<>
			<SidebarMenu>
				<AlertDialog>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton
									size="lg"
									className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
								>
									<Avatar className="h-8 w-8 rounded-lg">
										<AvatarFallback className="rounded-lg">N</AvatarFallback>
									</Avatar>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-medium">{user?.email?.split("@")[0]?.toUpperCase() ?? 'User'}</span>
										<span className="truncate text-xs">{user?.email ?? ''}</span>
									</div>
									<ChevronsUpDown className="ml-auto size-4" />
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg bg-sidebar text-sidebar-foreground"
								side={isMobile ? "bottom" : "right"}
								align="end"
								sideOffset={4}
							>
								<DropdownMenuLabel className="p-0 font-normal">
									<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
										<Avatar className="h-8 w-8 rounded-lg">
											<AvatarFallback className="rounded-lg">N</AvatarFallback>
										</Avatar>
										<div className="grid flex-1 text-left text-sm leading-tight">
											<span className="truncate font-medium">{user?.user_metadata?.name || user?.email?.split("@")[0]?.toUpperCase() || 'User'}</span>
											<span className="truncate text-xs">{user?.email ?? ''}</span>
										</div>
									</div>
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuGroup>
								</DropdownMenuGroup>
							
								<DropdownMenuItem asChild>
									<AlertDialogTrigger className="flex items-center gap-2 w-full cursor-pointer">
											<LogOut />
											Logout
										</AlertDialogTrigger>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
					<AlertDialogContent className="bg-slate-900/95 text-white border border-slate-700">
						<AlertDialogHeader>
							<AlertDialogTitle className="text-white">
								Are you sure you want to logout?
							</AlertDialogTitle>
							<AlertDialogDescription className="text-slate-300">
								You will be logged out of your account and redirected to the login page.
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter className="sm:flex-row sm:justify-end gap-2">
							<AlertDialogCancel className="bg-slate-700 text-white hover:bg-slate-600 border-0">
								Cancel
							</AlertDialogCancel>
							<AlertDialogAction
								className="bg-rose-500 text-white hover:bg-rose-500/90"
								onClick={signOut}
							>
								Continue
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>

				</AlertDialog>

			</SidebarMenu>

			{/* <AccountDialog 
				open={accountDialogOpen} 
				onOpenChange={setAccountDialogOpen} 
			/> */}
		</>
	)
}
