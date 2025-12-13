// src/components/Header.jsx
import { supabase } from '../supabaseClient'
import logo from '../assets/Fto Al Aire Rooftop.jpg'

export default function Header({ profile }) {
  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <header className="app-header">
      <div className="header-logo-container">
        <img src={logo} alt="Logo" className="header-logo" />
        <span className="header-title">Al Aire Rooftop</span>
      </div>
      <div className="header-user-container">
        <span className="user-name">Hola, {profile ? `${profile.nombre} ${profile.apellido}` : 'Usuario'}</span>
        <button onClick={handleSignOut} className="logout-button">Cerrar Sesión</button>
      </div>
    </header>
  )
}