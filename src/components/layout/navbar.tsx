'use client'

/**
 * Navbar Component
 * แถบเมนูหลักสำหรับทุกหน้า
 */

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { 
  Home, 
  Users, 
  Package, 
  ShoppingCart, 
  FileText, 
  Menu, 
  X,
  Bell,
  Settings,
  User,
  LogOut,
  ChevronDown
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const navItems = [
  { href: '/', label: 'หน้าแรก', icon: Home },
  { href: '/customers', label: 'ลูกค้า', icon: Users },
  { href: '/products', label: 'สินค้า', icon: Package },
  { href: '/orders', label: 'ออเดอร์', icon: ShoppingCart },
  { href: '/reports', label: 'รายงาน', icon: FileText, disabled: true },
]

export function Navbar() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/70 backdrop-blur-xl">
      <div className="px-4 md:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/25">
              A
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl text-slate-900 hidden sm:inline">
                Anajak ERP
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-md text-blue-700">
                v2.0
              </span>
            </div>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              
              return (
                <Link key={item.href} href={item.disabled ? '#' : item.href}>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    disabled={item.disabled}
                    className={`
                      gap-2 px-4 rounded-lg transition-all duration-200
                      ${active 
                        ? 'bg-blue-50 text-blue-700 font-medium' 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }
                      ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-blue-600' : ''}`} />
                    {item.label}
                  </Button>
                </Link>
              )
            })}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative hidden sm:flex">
              <Bell className="w-5 h-5 text-slate-500" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </Button>

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 pl-2 pr-3 hidden sm:flex">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-sm font-medium">
                    A
                  </div>
                  <span className="text-sm font-medium text-slate-700 hidden lg:inline">Admin</span>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="font-semibold">Admin User</span>
                    <span className="text-xs text-slate-500 font-normal">admin@anajak.com</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  โปรไฟล์
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  ตั้งค่า
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  ออกจากระบบ
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Button */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white">
          <div className="px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              
              return (
                <Link 
                  key={item.href} 
                  href={item.disabled ? '#' : item.href}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div 
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl transition-colors
                      ${active 
                        ? 'bg-blue-50 text-blue-700' 
                        : 'text-slate-600 hover:bg-slate-50'
                      }
                      ${item.disabled ? 'opacity-50' : ''}
                    `}
                  >
                    <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : ''}`} />
                    <span className="font-medium">{item.label}</span>
                  </div>
                </Link>
              )
            })}
            
            <div className="pt-3 border-t border-slate-100 mt-3">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white font-medium">
                  A
                </div>
                <div>
                  <p className="font-medium text-slate-900">Admin User</p>
                  <p className="text-sm text-slate-500">admin@anajak.com</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
