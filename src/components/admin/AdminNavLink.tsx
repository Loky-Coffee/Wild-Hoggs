import { useAuth } from '../../hooks/useAuth';

const LANGS = ['de','fr','ko','th','ja','pt','es','tr','id','zh-TW','zh-CN','it','ar','vi'];

function getAdminHref(): string {
  const [, first] = window.location.pathname.split('/');
  const lang = LANGS.includes(first) ? first : 'en';
  return lang === 'en' ? '/admin/' : `/${lang}/admin/`;
}

export default function AdminNavLink() {
  const { user } = useAuth();

  if (user?.is_admin !== 1) return null;

  const adminHref = getAdminHref();
  const rawPath = window.location.pathname;
  const currentPath = rawPath === '/' ? '/' : (rawPath.endsWith('/') ? rawPath : rawPath + '/');
  const isActive = currentPath === adminHref || currentPath.startsWith(adminHref);

  return (
    <a
      href={adminHref}
      class={['nav-link', isActive ? 'active' : ''].filter(Boolean).join(' ')}
    >
      Administration
    </a>
  );
}
