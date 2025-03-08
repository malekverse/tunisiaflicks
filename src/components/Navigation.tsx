import Link from 'next/link'

function Navigation() {
  return (
    <nav className="bg-gray-800">
      <ul className="flex">
        <li>
          <Link href="/dashboard" className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">
            Dashboard
          </Link>
        </li>
        <li>
          <Link href="/profile" className="text-gray-300 hover:bg-gray-700 hover:text-white px-3 py-2 rounded-md text-sm font-medium">
            Profile
          </Link>
        </li>
      </ul>
    </nav>
  );
}

export default Navigation;

