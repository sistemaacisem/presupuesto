/**
 * Users Module — Gestión de usuarios y roles
 */
import { api, rolLabel, currentUser } from '../api.js';
import { showToast } from '../components/toast.js';
import { openModal, closeModal, confirmModal } from '../components/modal.js';

export async function render(container) {
  const me = currentUser();
  if (me.role !== 'admin') {
    container.innerHTML = `
      <div class="empty-state" style="padding:80px">
        <div class="empty-state-icon" style="background:var(--error-bg);color:var(--error)">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:28px;height:28px"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
        </div>
        <h3>Acceso restringido</h3>
        <p>Solo los administradores pueden gestionar usuarios.</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="page-header">
      <div class="page-header-left">
        <h1>Usuarios</h1>
        <p>Gestión de accesos y permisos</p>
      </div>
      <div class="page-header-actions">
        <button class="btn btn-primary" onclick="openUserModal()">+ Nuevo usuario</button>
      </div>
    </div>

    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Email</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Miembro desde</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="users-tbody">
          <tr><td colspan="6" style="text-align:center;padding:32px"><div class="spinner"></div></td></tr>
        </tbody>
      </table>
    </div>

    <!-- Leyenda de roles -->
    <div class="card" style="margin-top:20px">
      <div class="card-header"><div class="card-title">Descripción de Roles</div></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
        <div style="padding:16px;background:var(--bg-body);border-radius:var(--radius-md)">
          <div style="font-weight:700;margin-bottom:6px">👑 Administrador</div>
          <div style="font-size:12.5px;color:var(--text-secondary)">Acceso total: gestionar usuarios, eliminar datos, configurar el sistema.</div>
        </div>
        <div style="padding:16px;background:var(--bg-body);border-radius:var(--radius-md)">
          <div style="font-weight:700;margin-bottom:6px">🛒 Compras</div>
          <div style="font-size:12.5px;color:var(--text-secondary)">Puede cargar presupuestos, crear proveedores y artículos. No gestiona usuarios.</div>
        </div>
        <div style="padding:16px;background:var(--bg-body);border-radius:var(--radius-md)">
          <div style="font-weight:700;margin-bottom:6px">👁 Consulta</div>
          <div style="font-size:12.5px;color:var(--text-secondary)">Solo lectura. Puede ver reportes, buscar y consultar precios.</div>
        </div>
      </div>
    </div>`;

  await loadUsers();
}

async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  try {
    const users = await api.getUsers();
    const me = currentUser();

    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="table-empty"><p>No hay usuarios</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:30px;height:30px;border-radius:50%;background:var(--accent);color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">
              ${u.name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()}
            </div>
            <div style="font-weight:500;font-size:13px">${u.name}</div>
          </div>
        </td>
        <td style="font-size:13px;color:var(--text-secondary)">${u.email}</td>
        <td>
          <span class="badge ${u.role==='admin'?'badge-error':u.role==='purchases'?'badge-accent':'badge-default'}">
            ${rolLabel(u.role)}
          </span>
        </td>
        <td>
          <span class="badge ${u.is_active?'badge-success':'badge-default'}">
            ${u.is_active ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td style="font-size:12px;color:var(--text-tertiary)">${new Date(u.created_at).toLocaleDateString('es-AR')}</td>
        <td>
          ${u.id !== me.id ? `
          <div class="flex gap-1">
            <button class="btn btn-ghost btn-sm" onclick="openUserModal('${u.id}', '${u.name.replace(/'/g,"\\'")}', '${u.email}', '${u.role}', ${u.is_active})" title="Editar">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button class="btn btn-ghost btn-sm" onclick="openPasswordModal('${u.id}')" title="Cambiar contraseña">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
            </button>
          </div>` : '<span style="font-size:12px;color:var(--text-tertiary)">Tú</span>'}
        </td>
      </tr>`).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty"><p style="color:var(--error-text)">${err.message}</p></td></tr>`;
  }
}

window.openUserModal = (id=null, name='', email='', role='readonly', isActive=true) => {
  openModal({
    title: id ? 'Editar Usuario' : 'Nuevo Usuario',
    size: 'md',
    body: `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="form-group"><label>Nombre completo *</label><input class="input" id="u-name" value="${name}"></div>
        <div class="form-group"><label>Email *</label><input class="input" id="u-email" type="email" value="${email}"></div>
        ${!id ? `<div class="form-group"><label>Contraseña *</label><input class="input" id="u-password" type="password" placeholder="Mínimo 6 caracteres"></div>` : ''}
        <div class="form-group">
          <label>Rol</label>
          <select class="select" id="u-role">
            <option value="admin"     ${role==='admin'     ?'selected':''}>Administrador</option>
            <option value="purchases" ${role==='purchases' ?'selected':''}>Compras</option>
            <option value="readonly"  ${role==='readonly'  ?'selected':''}>Solo lectura</option>
          </select>
        </div>
        ${id ? `
        <div class="form-group">
          <label>Estado</label>
          <select class="select" id="u-active">
            <option value="1" ${isActive?'selected':''}>Activo</option>
            <option value="0" ${!isActive?'selected':''}>Inactivo</option>
          </select>
        </div>` : ''}
      </div>`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
             <button class="btn btn-primary" onclick="saveUser('${id||''}')">Guardar</button>`
  });
};

window.saveUser = async (id) => {
  const name  = document.getElementById('u-name')?.value.trim();
  const email = document.getElementById('u-email')?.value.trim();
  const role  = document.getElementById('u-role')?.value;
  const pass  = document.getElementById('u-password')?.value;
  const active = document.getElementById('u-active')?.value;

  if (!name || !email) { showToast('Error', 'Nombre y email son requeridos', 'error'); return; }

  try {
    if (id) {
      await api.updateUser(id, { name, email, role, is_active: active !== '0' });
    } else {
      if (!pass || pass.length < 6) { showToast('Error', 'La contraseña debe tener al menos 6 caracteres', 'error'); return; }
      await api.createUser({ name, email, password: pass, role });
    }
    closeModal();
    showToast(id ? 'Usuario actualizado' : 'Usuario creado', name, 'success');
    await loadUsers();
  } catch (err) { showToast('Error', err.message, 'error'); }
};

window.openPasswordModal = (id) => {
  openModal({
    title: 'Cambiar Contraseña',
    size: 'sm',
    body: `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="form-group"><label>Nueva contraseña</label><input class="input" id="new-pass" type="password" placeholder="Mínimo 6 caracteres"></div>
        <div class="form-group"><label>Confirmar contraseña</label><input class="input" id="new-pass-conf" type="password"></div>
      </div>`,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
             <button class="btn btn-primary" onclick="savePassword('${id}')">Cambiar</button>`
  });
};

window.savePassword = async (id) => {
  const p1 = document.getElementById('new-pass')?.value;
  const p2 = document.getElementById('new-pass-conf')?.value;
  if (!p1 || p1.length < 6) { showToast('Error', 'Mínimo 6 caracteres', 'error'); return; }
  if (p1 !== p2) { showToast('Error', 'Las contraseñas no coinciden', 'error'); return; }
  try {
    await api.changePassword(id, p1);
    closeModal();
    showToast('Contraseña actualizada', '', 'success');
  } catch (err) { showToast('Error', err.message, 'error'); }
};
