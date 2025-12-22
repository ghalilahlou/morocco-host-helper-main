import React from 'react';
import { User, Settings, LogOut, Key, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useAdminContext } from '@/contexts/AdminContext';

interface UserMenuProps {
  onSignOut: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ onSignOut }) => {
  const { user } = useAuth();
  const { isAdmin } = useAdminContext();
  const navigate = useNavigate();
  
  // ✅ DEBUG TEMPORAIRE
  console.log('👤 UserMenu - user:', user?.email, 'isAdmin:', isAdmin);

  if (!user) return null;

  const userInitials = user.email
    ? user.email.substring(0, 2).toUpperCase()
    : 'U';

  const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Utilisateur';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.user_metadata?.avatar_url} alt={userName} />
            <AvatarFallback className="bg-[#0BD9D0] text-white font-semibold">
              {userInitials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 bg-white text-foreground z-50" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-3 p-2">
            <div className="flex items-center space-x-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={user.user_metadata?.avatar_url} alt={userName} />
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{userName}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer hover:bg-[hsl(var(--brand-2))] hover:text-white focus:bg-[hsl(var(--brand-2))] focus:text-white" onClick={() => navigate('/profile')}>
          <User className="mr-2 h-4 w-4" />
          <span>Profil</span>
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem className="cursor-pointer hover:bg-[hsl(var(--brand-2))] hover:text-white focus:bg-[hsl(var(--brand-2))] focus:text-white" onClick={() => navigate('/admin')}>
            <Shield className="mr-2 h-4 w-4" />
            <span>Administrateur</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="cursor-pointer hover:bg-[hsl(var(--brand-2))] hover:text-white focus:bg-[hsl(var(--brand-2))] focus:text-white" onClick={() => navigate('/account-settings')}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Paramètres du compte</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer hover:bg-[hsl(var(--brand-2))] hover:text-white focus:bg-[hsl(var(--brand-2))] focus:text-white" onClick={() => navigate('/change-password')}>
          <Key className="mr-2 h-4 w-4" />
          <span>Changer le mot de passe</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600" onClick={onSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Se déconnecter</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};