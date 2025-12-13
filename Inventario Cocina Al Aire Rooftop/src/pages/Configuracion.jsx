// src/pages/Configuracion.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const permissionLabels = {
  can_edit_inventory: 'Editar Inventario',
  can_register_movement: 'Registrar Movimientos',
  can_add_product: 'Agregar Productos',
  can_manage_users: 'Administrar Usuarios',
  can_manage_roles: 'Administrar Roles',
  can_save_inventory: 'Guardar Inventario',
  can_review_inventory: 'Revisar Inventario',
};

export default function Configuracion() {
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [existingRoles, setExistingRoles] = useState([]);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateRoleModalOpen, setIsCreateRoleModalOpen] = useState(false);
  const [isEditRoleModalOpen, setIsEditRoleModalOpen] = useState(false);
  const [isDeleteRoleModalOpen, setIsDeleteRoleModalOpen] = useState(false);

  const [editingRole, setEditingRole] = useState(null);
  const [deletingRole, setDeletingRole] = useState(null);

  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleMaxUsers, setNewRoleMaxUsers] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rolePermissions, setRolePermissions] = useState({
    can_edit_inventory: false,
    can_register_movement: false,
    can_add_product: false,
    can_manage_users: false,
    can_manage_roles: false,
    can_save_inventory: false,
    can_review_inventory: false,
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      /* ================= PERFIL ACTUAL ================= */
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, nombre, apellido, celular, roles(*)')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error(profileError);
        setLoading(false);
        return;
      }

      setUserProfile(profileData);

      /* ================= USUARIOS (ADMIN) ================= */
      if (profileData.roles?.can_manage_users || profileData.roles?.can_manage_roles) {
        const { data: rpcUsers, error: rpcError } =
          await supabase.rpc('get_all_users_with_details');

        let users = [];

        if (!rpcError && rpcUsers) {
          users = rpcUsers.map(u => ({
            id: u.id,
            nombre: u.nombre,
            apellido: u.apellido,
            rol: u.rol,
            email: u.email,
          }));
        }

        // Agregar SIEMPRE el usuario actual
        const currentUser = {
          id: user.id,
          nombre: profileData.nombre,
          apellido: profileData.apellido,
          rol: profileData.roles?.nombre,
          email: user.email,
        };

        const map = new Map(users.map(u => [u.id, u]));
        map.set(currentUser.id, currentUser);

        setAllUsers(Array.from(map.values()));

        /* ================= ROLES ================= */
        const { data: rolesData, error: rolesError } = await supabase
          .from('roles')
          .select('*') // Traemos todos los campos, incluidos permisos
          .order('nombre');

        if (!rolesError) setExistingRoles(rolesData || []);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  /* ================= CONTADOR DE ROLES ================= */
  const roleCounts = allUsers.reduce((acc, u) => {
    if (u.rol) acc[u.rol] = (acc[u.rol] || 0) + 1;
    return acc;
  }, {});

  /* ================= PERFIL ================= */
  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setUserProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        nombre: userProfile.nombre,
        apellido: userProfile.apellido,
        celular: userProfile.celular,
      })
      .eq('id', userProfile.id);

    if (!error) {
      alert('Perfil actualizado');
      setIsEditModalOpen(false);
    } else {
      alert(error.message);
    }

    setIsSubmitting(false);
  };

  /* ================= ROLES ================= */
  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;

    setIsSubmitting(true);

    const { data, error } = await supabase
      .from('roles')
      .insert({
        nombre: newRoleName.trim(),
        max_users: newRoleMaxUsers ? parseInt(newRoleMaxUsers) : null,
        ...rolePermissions,
      })
      .select();

    if (!error && data) {
      setExistingRoles(prev => [...prev, ...data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setIsCreateRoleModalOpen(false);
      setNewRoleName('');
      setNewRoleMaxUsers('');
      // Reset permissions
      setRolePermissions(Object.keys(rolePermissions).reduce((acc, key) => ({ ...acc, [key]: false }), {}));
    } else {
      alert(error.message);
    }

    setIsSubmitting(false);
  };

  const handleUpdateRole = async (e) => {
    e.preventDefault();
    if (!editingRole) return;

    setIsSubmitting(true);

    const { data, error } = await supabase
      .from('roles')
      .update({
        max_users: editingRole.max_users ? parseInt(editingRole.max_users) : null,
        ...rolePermissions,
      })
      .eq('id', editingRole.id)
      .select();

    if (!error && data) {
      setExistingRoles(prev =>
        prev.map(r => (r.id === editingRole.id ? data[0] : r))
      );
      setIsEditRoleModalOpen(false);
      setEditingRole(null);
    } else {
      alert(error.message);
    }

    setIsSubmitting(false);
  };

  const handleConfirmDeleteRole = async () => {
    if (!deletingRole) return;

    if (roleCounts[deletingRole.nombre] > 0) {
      alert('No se puede eliminar un rol en uso');
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', deletingRole.id);

    if (!error) {
      setExistingRoles(prev => prev.filter(r => r.id !== deletingRole.id));
      setIsDeleteRoleModalOpen(false);
      setDeletingRole(null);
    } else {
      alert(error.message);
    }

    setIsSubmitting(false);
  };

  const handlePermissionChange = (e) => {
    const { name, checked } = e.target;
    setRolePermissions(prev => ({ ...prev, [name]: checked }));
  };

  if (loading) return <p>Cargando configuración...</p>;

  return (
    <div className="config-container">
      <h1>Configuración</h1>
      <div className="profile-edit-section">
        <button className="edit-profile-btn" onClick={() => setIsEditModalOpen(true)}>
          Editar mi perfil
        </button>
      </div>

      {userProfile?.roles?.can_manage_users && (
        <>
          <div className="user-admin-section">
            <h4>Administración de Usuarios</h4>
            <div className="table-responsive">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Rol</th>
                    <th>Correo</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map(u => (
                    <tr key={u.id}>
                      <td>{u.nombre} {u.apellido}</td>
                      <td>{u.rol || 'N/A'}</td>
                      <td>{u.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {userProfile?.roles?.can_manage_roles && (
          <div className="user-admin-section" style={{ marginTop: '40px' }}>
            <div className="role-management-header">
              <h4>Administración de Roles</h4>
              <button className="add-product-button" onClick={() => setIsCreateRoleModalOpen(true)}>
                Agregar Rol
              </button>
            </div>
            <div className="table-responsive">
              <table className="inventory-table">
                <thead>
                  <tr>
                    <th>Rol</th>
                    <th>Usuarios</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {existingRoles.map(r => (
                    <tr key={r.id}>
                      <td>{r.nombre}</td>
                      <td>{roleCounts[r.nombre] || 0} / {r.max_users ?? '∞'}</td>
                      <td className="actions-cell">
                    <button className="action-button edit-button" onClick={() => {
                      setEditingRole(r);
                      // Cargar permisos actuales del rol para editar
                      const currentPermissions = Object.keys(permissionLabels).reduce((acc, key) => {
                        acc[key] = r[key] || false;
                        return acc;
                      }, {});
                      setRolePermissions(currentPermissions);
                      setIsEditRoleModalOpen(true);
                    }}>✏️</button>
                    <button className="action-button delete-button" onClick={() => {
                      setDeletingRole(r);
                      setIsDeleteRoleModalOpen(true);
                    }}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
      )}

      {/* MODALES */}
      {isEditModalOpen && userProfile && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Editar Perfil</h2>
            <form onSubmit={handleUpdateProfile} className="modal-form">
              <div className="form-group"><label>Nombre</label><input name="nombre" value={userProfile.nombre} onChange={handleProfileChange} /></div>
              <div className="form-group"><label>Apellido</label><input name="apellido" value={userProfile.apellido} onChange={handleProfileChange} /></div>
              <div className="form-group"><label>Celular</label><input name="celular" value={userProfile.celular} onChange={handleProfileChange} /></div>
              <div className="modal-actions">
                <button type="button" className="modal-button-cancel" onClick={() => setIsEditModalOpen(false)}>Cancelar</button>
                <button type="submit" className="modal-button-confirm" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCreateRoleModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Crear Rol</h2>
            <form onSubmit={handleCreateRole} className="modal-form">
              <div className="form-group"><label>Nombre del Rol</label><input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} required /></div>
              <div className="form-group"><label>Cantidad Máxima</label><input type="number" value={newRoleMaxUsers} onChange={(e) => setNewRoleMaxUsers(e.target.value)} min="1" /></div>
              <div className="form-group">
                <label>Permisos</label>
                <div className="permissions-grid">
                  {Object.entries(permissionLabels).map(([key, label]) => (
                    <div key={key} className="permission-item">
                      <input type="checkbox" id={`perm-${key}`} name={key} checked={rolePermissions[key]} onChange={handlePermissionChange} />
                      <label htmlFor={`perm-${key}`}>{label}</label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="modal-button-cancel" onClick={() => setIsCreateRoleModalOpen(false)}>Cancelar</button>
                <button type="submit" className="modal-button-confirm" disabled={isSubmitting}>{isSubmitting ? 'Creando...' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditRoleModalOpen && editingRole && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Editar Rol: {editingRole.nombre}</h2>
            <form onSubmit={handleUpdateRole} className="modal-form">
              <div className="form-group"><label>Cantidad Máxima</label><input type="number" value={editingRole.max_users || ''} onChange={(e) => setEditingRole({ ...editingRole, max_users: e.target.value })} min="1" /></div>
              <div className="form-group">
                <label>Permisos</label>
                <div className="permissions-grid">
                  {Object.entries(permissionLabels).map(([key, label]) => (
                    <div key={`edit-perm-${key}`} className="permission-item">
                      <input type="checkbox" id={`edit-perm-${key}`} name={key} checked={rolePermissions[key]} onChange={handlePermissionChange} />
                      <label htmlFor={`edit-perm-${key}`}>{label}</label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="modal-button-cancel" onClick={() => setIsEditRoleModalOpen(false)}>Cancelar</button>
                <button type="submit" className="modal-button-confirm" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteRoleModalOpen && deletingRole && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title modal-title-danger">Confirmar Eliminación</h2>
            <p className="modal-message">¿Seguro que quieres eliminar el rol <strong>{deletingRole.nombre}</strong>?</p>
            <div className="modal-actions">
              <button type="button" className="modal-button-cancel" onClick={() => setIsDeleteRoleModalOpen(false)}>Cancelar</button>
              <button type="button" className="modal-button-danger" onClick={handleConfirmDeleteRole} disabled={isSubmitting}>{isSubmitting ? 'Eliminando...' : 'Eliminar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
