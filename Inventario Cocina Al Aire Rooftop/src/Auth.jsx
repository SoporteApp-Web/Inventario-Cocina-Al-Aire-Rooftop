// src/Auth.jsx

import { useState, useEffect } from 'react'
import './index.css' // Importamos los estilos CSS
import { FaEnvelope, FaLock, FaUser, FaPhone, FaBriefcase, FaEye, FaEyeSlash } from 'react-icons/fa' // Importamos los iconos
import { supabase } from './supabaseClient'
import logo from './assets/Fto Al Aire Rooftop.jpg' // Importamos la imagen del logo

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true) // true para Login, false para Registro
  const [loading, setLoading] = useState(false)
  // Campos del formulario
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [celular, setCelular] = useState('')
  const [rolId, setRolId] = useState('')
  // Estados adicionales
  const [roles, setRoles] = useState([])
  const [showPassword, setShowPassword] = useState(false)
  // Estado para el modal
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '' })

  // Cargar roles desde Supabase al montar el componente
  useEffect(() => {
    const fetchRoles = async () => {
      const { data, error } = await supabase.from('roles').select('id, nombre')
      if (error) console.error('Error fetching roles:', error)
      else setRoles(data)
    }

    fetchRoles()
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)

    try {
      if (isLogin) {
        // Lógica de Login
        let loginEmail = email

        // Si no es un correo, intentamos buscarlo por nombre y apellido
        if (!email.includes('@')) {
          const { data, error: rpcError } = await supabase.rpc('get_email_from_fullname', {
            full_name: email,
          })

          if (rpcError || !data) {
            throw new Error('Usuario no encontrado. Verifica el nombre y apellido o usa tu correo.')
          }
          loginEmail = data
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({ email: loginEmail, password })
        if (signInError) throw signInError

      } else {
        // Lógica de Registro
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              nombre,
              apellido,
              celular,
              rol_id: parseInt(rolId), // Guardamos el ID del rol
            },
          },
        })
        if (error) throw error
        setModal({
          isOpen: true,
          title: '¡Registro Exitoso!',
          message: 'Hemos enviado un enlace de verificación a tu correo. Por favor, revísalo para activar tu cuenta y poder iniciar sesión.',
        })
        // Cambiamos al modo de login después del registro exitoso
      }
    } catch (error) {
      setModal({
        isOpen: true,
        title: 'Error',
        message: error.error_description || error.message,
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setIsLogin(!isLogin)
    // Limpiamos los campos al cambiar de modo
    setEmail('')
    setPassword('')
    setNombre('')
    setApellido('')
    setCelular('')
    setRolId('')
    // Llevamos la vista al tope de la página para evitar el espacio en blanco en móviles
    window.scrollTo(0, 0)
  }

  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '' })
    // Si el título era de éxito, cambiamos a la vista de login
    if (modal.title.includes('Exitoso')) {
      toggleMode()
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-box">
        <img src={logo} alt="Logo del Restaurante" className="auth-logo" />
        <h1 className="header">{isLogin ? 'Inventario de Cocina' : 'Crear Nueva Cuenta'}</h1>
        <p className="description">
          {isLogin ? 'Inicia sesión para acceder al sistema.' : 'Ingresa tus datos para registrarte.'}
        </p>
        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-grid">
              <div className="input-wrapper">
                <FaUser className="input-icon" /> <input className="input-field" type="text" placeholder="Nombre" value={nombre} required={true} onChange={(e) => setNombre(e.target.value)} />
              </div>
              <div className="input-wrapper">
                <FaUser className="input-icon" /> <input className="input-field" type="text" placeholder="Apellido" value={apellido} required={true} onChange={(e) => setApellido(e.target.value)} />
              </div>
              <div className="input-wrapper grid-col-span-2">
                <FaPhone className="input-icon" /> <input className="input-field" type="tel" placeholder="Celular" value={celular} required={true} onChange={(e) => setCelular(e.target.value)} />
              </div>
              <div className="input-wrapper grid-col-span-2">
                <FaBriefcase className="input-icon" />
                <select className="input-field" value={rolId} required={true} onChange={(e) => setRolId(e.target.value)}>
                  <option value="" disabled>
                    Selecciona un Rol
                  </option>
                  {roles.map((rol) => (
                    <option key={rol.id} value={rol.id}>
                      {rol.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="input-wrapper">
            <FaUser className="input-icon" /> <input className="input-field" type="text" placeholder="Correo o Nombre y Apellido" value={email} required={true} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="input-wrapper">
            <FaLock className="input-icon" />
            <input className="input-field" type={showPassword ? 'text' : 'password'} placeholder="Contraseña" value={password} required={true} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="password-toggle-button" onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>

          <div>
            <button className="auth-button" disabled={loading}>
              {loading ? <span>{isLogin ? 'Verificando...' : 'Registrando...'}</span> : <span>{isLogin ? 'Acceder' : 'Registrarse'}</span>}
            </button>
          </div>
        </form>
        <div className="auth-toggle">
          <button onClick={toggleMode} className="auth-toggle-button">
            {isLogin ? '¿No tienes una cuenta? Regístrate' : '¿Ya tienes una cuenta? Inicia Sesión'}
          </button>
        </div>
      </div>

      {/* Modal para notificaciones */}
      {modal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">{modal.title}</h2>
            <p className="modal-message">{modal.message}</p>
            <button onClick={closeModal} className="modal-close-button">
              Aceptar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}