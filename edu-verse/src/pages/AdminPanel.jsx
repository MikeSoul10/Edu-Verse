import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';
import toast from 'react-hot-toast';

const AdminPanel = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [baneados, setBaneados] = useState([]);
  const [logs, setLogs] = useState([]);
  const [apuntes, setApuntes] = useState([]);
  const [comentarios, setComentarios] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [banModal, setBanModal] = useState({ open: false, usuario: null });
  const [banMotivo, setBanMotivo] = useState('');

  useEffect(() => {
    if (!user || user.rol !== 'admin') navigate('/');
  }, [user, navigate]);

  useEffect(() => {
    if (user?.rol === 'admin') fetchStats();
  }, [user]);

  const fetchStats = async () => {
    try {
      const res = await axios.get('/admin/stats');
      setStats(res.data);
    } catch (err) {
      toast.error('Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsuarios = async () => {
    try {
      const [resUsuarios, resBaneados] = await Promise.all([
        axios.get('/admin/usuarios'),
        axios.get('/admin/baneados'),
      ]);
      setUsuarios(resUsuarios.data);
      setBaneados(resBaneados.data);
    } catch { toast.error('Error al cargar usuarios'); }
  };

  const fetchBaneados = async () => {
    try { const res = await axios.get('/admin/baneados'); setBaneados(res.data); } catch { toast.error('Error al cargar baneados'); }
  };

  const fetchLogs = async () => {
    try { const res = await axios.get('/admin/logs'); setLogs(res.data); } catch { toast.error('Error al cargar logs'); }
  };

  const fetchApuntes = async () => {
    try { const res = await axios.get('/admin/apuntes'); setApuntes(res.data); } catch { toast.error('Error al cargar apuntes'); }
  };

  const fetchComentarios = async () => {
    try { const res = await axios.get('/admin/comentarios'); setComentarios(res.data); } catch { toast.error('Error al cargar comentarios'); }
  };

  const fetchEquipos = async () => {
    try { const res = await axios.get('/admin/equipos'); setEquipos(res.data); } catch { toast.error('Error al cargar equipos'); }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchTerm('');
    if (tab === 'usuarios') fetchUsuarios();
    if (tab === 'baneados') fetchBaneados();
    if (tab === 'logs') fetchLogs();
    if (tab === 'apuntes') fetchApuntes();
    if (tab === 'comentarios') fetchComentarios();
    if (tab === 'equipos') fetchEquipos();
  };

  const handleDeleteUser = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar al usuario "${nombre}"?`)) return;
    try { await axios.delete(`/admin/usuarios/${id}`); toast.success('Usuario eliminado'); fetchUsuarios(); } catch (err) { toast.error(err.response?.data || 'Error al eliminar'); }
  };

  const handleBan = async () => {
    if (!banModal.usuario) return;
    try {
      await axios.post('/admin/ban', { usuario_id: banModal.usuario.usuario_id, motivo: banMotivo });
      toast.success(`${banModal.usuario.nombre} ha sido baneado`);
      setBanModal({ open: false, usuario: null }); setBanMotivo(''); fetchUsuarios();
    } catch (err) { toast.error(err.response?.data || 'Error al banear'); }
  };

  const handleUnban = async (email) => {
    if (!window.confirm(`¿Desbanear a ${email}?`)) return;
    try { await axios.delete(`/admin/baneados/${encodeURIComponent(email)}`); toast.success('Desbaneado'); fetchBaneados(); fetchUsuarios(); } catch { toast.error('Error al desbanear'); }
  };

  const handleDeleteApunte = async (id) => {
    if (!window.confirm('¿Eliminar este apunte?')) return;
    try { await axios.delete(`/admin/apuntes/${id}`); toast.success('Apunte eliminado'); fetchApuntes(); } catch { toast.error('Error al eliminar'); }
  };

  const handleDeleteComentario = async (id) => {
    if (!window.confirm('¿Eliminar este comentario?')) return;
    try { await axios.delete(`/admin/comentarios/${id}`); toast.success('Comentario eliminado'); fetchComentarios(); } catch { toast.error('Error al eliminar'); }
  };

  const handleDeleteEquipo = async (id) => {
    if (!window.confirm('¿Eliminar este equipo? Se borrarán sus tareas y mensajes.')) return;
    try { await axios.delete(`/admin/equipos/${id}`); toast.success('Equipo eliminado'); fetchEquipos(); } catch { toast.error('Error al eliminar'); }
  };

  if (!user || user.rol !== 'admin') return null;

  const filter = (items, keys) => {
    if (!searchTerm) return items;
    const q = searchTerm.toLowerCase();
    return items.filter(item => keys.some(k => String(item[k] || '').toLowerCase().includes(q)));
  };

  const filteredUsuarios = filter(usuarios, ['nombre', 'email']);
  const filteredApuntes = filter(apuntes, ['titulo', 'materia', 'autor']);
  const filteredComentarios = filter(comentarios, ['texto', 'autor', 'apunte_titulo']);
  const filteredEquipos = filter(equipos, ['nombre', 'creador_nombre']);

  const tabs = [
    { id: 'stats', label: 'Estadísticas', icon: '📊' },
    { id: 'usuarios', label: 'Usuarios', icon: '👥' },
    { id: 'apuntes', label: 'Apuntes', icon: '📄' },
    { id: 'comentarios', label: 'Comentarios', icon: '💬' },
    { id: 'equipos', label: 'Equipos', icon: '🏢' },
    { id: 'baneados', label: 'Baneados', icon: '🚫' },
    { id: 'logs', label: 'Actividad', icon: '📋' },
  ];

  const searchPlaceholders = {
    usuarios: 'Buscar por nombre o email...',
    apuntes: 'Buscar por título, materia o autor...',
    comentarios: 'Buscar por texto, autor o apunte...',
    equipos: 'Buscar por nombre o creador...',
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Panel de Administración</h1>
          <p className="text-gray-500 mt-1">Gestiona usuarios, contenido y configuración de Edu-Verse</p>
        </div>

        <div className="flex space-x-1 bg-white rounded-xl p-1 shadow-sm border border-gray-200 mb-6 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
                activeTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        ) : (
          <>
            {/* TAB: Estadísticas */}
            {activeTab === 'stats' && stats && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <StatCard title="Usuarios totales" value={stats.totalUsuarios} color="blue" />
                  <StatCard title="Apuntes totales" value={stats.totalApuntes} color="emerald" />
                  <StatCard title="Equipos creados" value={stats.totalEquipos} color="purple" />
                  <StatCard title="Comentarios" value={stats.totalComentarios} color="amber" />
                  <StatCard title="Tareas" value={stats.totalTareas} color="rose" />
                  <StatCard title="Baneados" value={stats.totalBaneados} color="red" />
                  <StatCard title="Apuntes hoy" value={stats.apuntesHoy} color="emerald" />
                  <StatCard title="Usuarios hoy" value={stats.usuariosHoy} color="blue" />
                  <StatCard title="Equipos hoy" value={stats.equiposHoy} color="purple" />
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                  <ChartCard title="Apuntes (7 días)" data={stats.apuntesPorDia || []} color="emerald" />
                  <ChartCard title="Usuarios (7 días)" data={stats.usuariosPorDia || []} color="blue" />
                  <ChartCard title="Equipos (7 días)" data={stats.equiposPorDia || []} color="purple" />
                </div>
              </div>
            )}

            {/* TAB: Usuarios */}
            {activeTab === 'usuarios' && (
              <ContentTable
                search={searchTerm}
                onSearch={setSearchTerm}
                placeholder={searchPlaceholders.usuarios}
                isEmpty={filteredUsuarios.length === 0}
                emptyIcon="👥"
                emptyText="No hay usuarios"
                headers={['ID', 'Nombre', 'Email', 'Rol', 'Registro', 'Acciones']}
                colSpans={[false, false, false, false, false, true]}
                rows={filteredUsuarios.map(u => ({
                  key: u.usuario_id,
                  cells: [
                    <span className="text-gray-500">{u.usuario_id}</span>,
                    <div className="flex items-center gap-3">
                      <img src={u.foto_url ? `${API_URL}${u.foto_url}` : `https://ui-avatars.com/api/?name=${u.nombre}&background=0D8ABC&color=fff`} className="w-8 h-8 rounded-full object-cover" alt="" onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${u.nombre}&background=ccc`; }} />
                      <span className="font-medium text-gray-900">{u.nombre}</span>
                    </div>,
                    <span className="text-gray-600">{u.email}</span>,
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.rol === 'admin' ? 'bg-red-100 text-red-700' : baneados.some(b => b.email === u.email) ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{baneados.some(b => b.email === u.email) ? 'Baneado' : u.rol}</span>,
                    <span className="text-gray-500">{new Date(u.fecha_registro).toLocaleDateString()}</span>,
                    <div className="flex items-center justify-end gap-2">
                      {u.rol !== 'admin' ? (
                        <>
                          {baneados.some(b => b.email === u.email) ? (
                            <button onClick={() => handleUnban(u.email)} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 text-xs font-medium transition-colors">Desbanear</button>
                          ) : (
                            <button onClick={() => setBanModal({ open: true, usuario: u })} className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 text-xs font-medium transition-colors">Banear</button>
                          )}
                          <button onClick={() => handleDeleteUser(u.usuario_id, u.nombre)} className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 text-xs font-medium transition-colors">Eliminar</button>
                        </>
                      ) : <span className="text-xs text-gray-400 italic">Admin</span>}
                    </div>
                  ]
                }))}
              />
            )}

            {/* TAB: Apuntes */}
            {activeTab === 'apuntes' && (
              <ContentTable
                search={searchTerm}
                onSearch={setSearchTerm}
                placeholder={searchPlaceholders.apuntes}
                isEmpty={filteredApuntes.length === 0}
                emptyIcon="📄"
                emptyText="No hay apuntes"
                headers={['ID', 'Título', 'Materia', 'Autor', 'Subido', 'Acciones']}
                rows={filteredApuntes.map(a => ({
                  key: a.apunte_id,
                  cells: [
                    <span className="text-gray-500">{a.apunte_id}</span>,
                    <span className="font-medium text-gray-900 max-w-[200px] truncate block">{a.titulo}</span>,
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">{a.materia}</span>,
                    <span className="text-gray-600">{a.autor}</span>,
                    <span className="text-gray-500 text-xs">{new Date(a.fecha_subida).toLocaleDateString()}</span>,
                    <div className="flex items-center justify-end gap-2">
                      <a href={`${API_URL}${a.archivo_url}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-xs font-medium transition-colors">Ver</a>
                      <button onClick={() => handleDeleteApunte(a.apunte_id)} className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 text-xs font-medium transition-colors">Eliminar</button>
                    </div>
                  ]
                }))}
              />
            )}

            {/* TAB: Comentarios */}
            {activeTab === 'comentarios' && (
              <ContentTable
                search={searchTerm}
                onSearch={setSearchTerm}
                placeholder={searchPlaceholders.comentarios}
                isEmpty={filteredComentarios.length === 0}
                emptyIcon="💬"
                emptyText="No hay comentarios"
                headers={['ID', 'Comentario', 'Autor', 'En apunte', 'Fecha', 'Acciones']}
                rows={filteredComentarios.map(c => ({
                  key: c.comentario_id,
                  cells: [
                    <span className="text-gray-500">{c.comentario_id}</span>,
                    <span className="text-gray-900 max-w-[300px] truncate block">{c.texto}</span>,
                    <span className="text-gray-600 font-medium">{c.autor}</span>,
                    <span className="text-blue-600 text-xs">{c.apunte_titulo}</span>,
                    <span className="text-gray-500 text-xs">{new Date(c.fecha_creacion).toLocaleDateString()}</span>,
                    <div className="flex items-center justify-end">
                      <button onClick={() => handleDeleteComentario(c.comentario_id)} className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 text-xs font-medium transition-colors">Eliminar</button>
                    </div>
                  ]
                }))}
              />
            )}

            {/* TAB: Equipos */}
            {activeTab === 'equipos' && (
              <ContentTable
                search={searchTerm}
                onSearch={setSearchTerm}
                placeholder={searchPlaceholders.equipos}
                isEmpty={filteredEquipos.length === 0}
                emptyIcon="🏢"
                emptyText="No hay equipos"
                headers={['ID', 'Nombre', 'Código', 'Creador', 'Miembros', 'Tareas', 'Creado', 'Acciones']}
                rows={filteredEquipos.map(e => ({
                  key: e.equipo_id,
                  cells: [
                    <span className="text-gray-500">{e.equipo_id}</span>,
                    <span className="font-medium text-gray-900">{e.nombre}</span>,
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs font-mono font-bold">{e.codigo_invitacion}</span>,
                    <span className="text-gray-600">{e.creador_nombre}</span>,
                    <span className="text-center bg-gray-100 rounded-full px-2 py-0.5 text-xs font-bold">{e.total_miembros}</span>,
                    <span className="text-center bg-gray-100 rounded-full px-2 py-0.5 text-xs font-bold">{e.total_tareas}</span>,
                    <span className="text-gray-500 text-xs">{new Date(e.fecha_creacion).toLocaleDateString()}</span>,
                    <div className="flex items-center justify-end">
                      <button onClick={() => handleDeleteEquipo(e.equipo_id)} className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 text-xs font-medium transition-colors">Eliminar</button>
                    </div>
                  ]
                }))}
              />
            )}

            {/* TAB: Baneados */}
            {activeTab === 'baneados' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                {baneados.length === 0 ? (
                  <div className="py-16 text-center text-gray-400">
                    <p className="text-4xl mb-2">✅</p>
                    <p className="font-medium">No hay usuarios baneados</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium">Email</th>
                          <th className="text-left px-4 py-3 font-medium">Motivo</th>
                          <th className="text-left px-4 py-3 font-medium">Baneado por</th>
                          <th className="text-left px-4 py-3 font-medium">Fecha</th>
                          <th className="text-right px-4 py-3 font-medium">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {baneados.map(b => (
                          <tr key={b.baneo_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{b.email}</td>
                            <td className="px-4 py-3 text-gray-600">{b.motivo}</td>
                            <td className="px-4 py-3 text-gray-500">{b.admin_nombre || 'N/A'}</td>
                            <td className="px-4 py-3 text-gray-500">{new Date(b.fecha_baneo).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-right">
                              <button onClick={() => handleUnban(b.email)} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 text-xs font-medium transition-colors">Desbanear</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB: Logs */}
            {activeTab === 'logs' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                {logs.length === 0 ? (
                  <div className="py-16 text-center text-gray-400">
                    <p className="text-4xl mb-2">📋</p>
                    <p className="font-medium">No hay actividad registrada</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {logs.map(log => (
                      <div key={log.log_id} className="px-4 py-3 hover:bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-gray-900">{log.admin_nombre}</span>
                            <span className="mx-2 text-gray-400">•</span>
                            <span className="text-gray-600">{log.accion.replace(/_/g, ' ')}</span>
                          </div>
                          <span className="text-xs text-gray-400">{new Date(log.fecha).toLocaleString()}</span>
                        </div>
                        {log.detalle && <p className="text-sm text-gray-500 mt-1 ml-0.5">{log.detalle}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Ban Modal */}
      {banModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Banear usuario</h3>
            <p className="text-sm text-gray-500 mb-4">
              <strong>{banModal.usuario?.nombre}</strong> no podrá iniciar sesión en la plataforma.
            </p>
            <textarea
              placeholder="Motivo del baneo (opcional)"
              value={banMotivo}
              onChange={(e) => setBanMotivo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-amber-500 outline-none"
              rows={3}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setBanModal({ open: false, usuario: null }); setBanMotivo(''); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={handleBan} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors">Banear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ContentTable = ({ search, onSearch, placeholder, isEmpty, emptyIcon, emptyText, headers, rows }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200">
    <div className="p-4 border-b border-gray-100">
      <input
        type="text"
        placeholder={placeholder}
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        className="w-full md:w-96 px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
      />
    </div>
    {isEmpty ? (
      <div className="py-16 text-center text-gray-400">
        <p className="text-4xl mb-2">{emptyIcon}</p>
        <p className="font-medium">{emptyText}</p>
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className={`px-4 py-3 font-medium ${i === headers.length - 1 ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(row => (
              <tr key={row.key} className="hover:bg-gray-50">
                {row.cells.map((cell, i) => (
                  <td key={i} className={`px-4 py-3 ${i === row.cells.length - 1 ? 'text-right' : ''}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const StatCard = ({ title, value, color }) => {
  const colors = {
    blue: 'bg-blue-50 text-blue-700 ring-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    purple: 'bg-purple-50 text-purple-700 ring-purple-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-100',
    rose: 'bg-rose-50 text-rose-700 ring-rose-100',
    red: 'bg-red-50 text-red-700 ring-red-100',
  };
  return (
    <div className={`rounded-xl p-4 ring-1 ${colors[color]}`}>
      <p className="text-sm font-medium opacity-80">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
};

const ChartCard = ({ title, data, color }) => {
  const barColors = { emerald: 'bg-emerald-500', blue: 'bg-blue-500', purple: 'bg-purple-500' };
  const safeData = Array.isArray(data) ? data : [];
  const maxVal = safeData.length > 0 ? Math.max(...safeData.map(d => parseInt(d?.total || 0)), 1) : 1;

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
      <h3 className="font-semibold text-gray-800 mb-4">{title}</h3>
      {safeData.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">Sin datos recientes</p>
      ) : (
        <div className="space-y-2">
          {safeData.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-20 shrink-0">
                {d?.dia ? new Date(d.dia).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }) : '—'}
              </span>
              <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                <div className={`h-full rounded-full ${barColors[color]} transition-all duration-500`} style={{ width: `${(parseInt(d?.total || 0) / maxVal) * 100}%` }} />
              </div>
              <span className="text-xs font-bold text-gray-700 w-6 text-right">{d?.total || 0}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
