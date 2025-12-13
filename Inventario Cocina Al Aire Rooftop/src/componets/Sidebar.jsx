// src/components/Sidebar.jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FaBars, FaWarehouse, FaChartBar, FaCog } from 'react-icons/fa'

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(true)

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <button className="sidebar-toggle" onClick={() => setIsCollapsed(!isCollapsed)}>
        <FaBars />
      </button>
      <nav className="sidebar-nav">
        <ul>
          <li><Link to="/inventario"><FaWarehouse /> <span>Inventario</span></Link></li>
          <li><Link to="/reporte"><FaChartBar /> <span>Reporte</span></Link></li>
          <li><Link to="/configuracion"><FaCog /> <span>Configuración</span></Link></li>
        </ul>
      </nav>
    </aside>
  )
}