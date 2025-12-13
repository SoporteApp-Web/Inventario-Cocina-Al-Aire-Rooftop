// src/App.jsx

import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import Header from './componets/Header' // Asegúrate que la ruta a tu carpeta sea correcta
import Sidebar from './componets/Sidebar' // Asegúrate que la ruta a tu carpeta sea correcta
import Inventario from './pages/Inventario.jsx'
import Reporte from './pages/Reporte.jsx'
import Configuracion from './pages/Configuracion.jsx'

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true) // Cambiamos el estado inicial a true
  const [setError] = useState(null)

  useEffect(() => {
    // onAuthStateChange se encarga tanto de la sesión inicial como de los cambios futuros.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // El evento 'INITIAL_SESSION' se dispara al cargar, reemplazando getSession().
      setSession(session)
    })

    // 3. Limpia la suscripción cuando el componente se desmonte
    return () => subscription.unsubscribe()
  }, [])

  // Este efecto se ejecutará solo si hay una sesión
  useEffect(() => {
    if (session?.user) {
      getProfile()
    } else {
      setLoading(false) // Si no hay sesión, dejamos de cargar
    }
  }, [session]) // Se vuelve a ejecutar si la sesión cambia

  async function getProfile() {
    try {
      setLoading(true)
      const { user } = session
      const { data, error, status } = await supabase
        .from('profiles')
        .select(`nombre, apellido, roles ( * )`) // Traemos todos los datos del rol, incluidos los permisos
        .eq('id', user.id)
        .single()

      if (error && status !== 406) throw error

      if (data) {
        setProfile(data)
      }
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  // Mostramos un indicador de carga mientras se verifica la sesión
  if (loading) {
    return <div>Cargando...</div>;
  }

  if (!session) {
    return <Auth />
  } else {
    return (
      <div className="app-layout">
        <Sidebar />
        <div className="main-content">
          <Header profile={profile} />
          <main className="app-body">
            <Routes>
              <Route path="/" element={<Navigate to="/inventario" replace />} />
              <Route path="/inventario" element={<Inventario profile={profile} />} />
              <Route path="/reporte" element={<Reporte />} />
              <Route path="/configuracion" element={<Configuracion />} />
            </Routes>
          </main>
          <footer className="app-footer">Al Aire Rooftop</footer>
        </div>
      </div>
    )
  }
}

export default App
