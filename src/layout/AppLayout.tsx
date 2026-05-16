import { AppShell, Burger, Group, NavLink, Text, Button } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  IconDashboard,
  IconBuildingWarehouse,
  IconPackages,
  IconCurrencyDollar,
  IconTable,
} from '@tabler/icons-react';
import { useAuth } from '@/auth/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: 'Главная', icon: IconDashboard },
  { to: '/suppliers', label: 'Поставщики', icon: IconBuildingWarehouse },
  { to: '/products', label: 'Продукты', icon: IconPackages },
  { to: '/prices', label: 'Цены', icon: IconCurrencyDollar },
  { to: '/dataframe', label: 'Dataframe', icon: IconTable },
];

export function AppLayout() {
  const [opened, { toggle }] = useDisclosure();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text fw={700} size="lg">
              Price Manager
            </Text>
          </Group>
          <Group>
            {user && <Text size="sm">{user.username}</Text>}
            <Button size="xs" variant="subtle" onClick={handleLogout}>
              Выйти
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            component={Link}
            to={to}
            label={label}
            leftSection={<Icon size={18} />}
            active={location.pathname === to}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
