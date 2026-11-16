import { Pencil, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Modal } from "../components/ui/Modal";
import { useAuth } from "../features/auth";
import {
  createUser,
  deleteUser,
  getUserPermissions,
  listRoles,
  listUsers,
  resetUserPermission,
  setUserPermission,
  updateUser,
  type EffectivePermission,
  type ManagedUser,
  type ManagedRole,
  type UserRole,
} from "../features/users/services/users";
import { errorMessage } from "../utils/errors";

const emptyForm = {
  nom: "",
  email: "",
  roles: ["ASSISTANT"] as UserRole[],
};

export default function UserManagementPage() {
  const { role } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<ManagedRole[]>([]);
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [permissions, setPermissions] = useState<EffectivePermission[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ManagedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadUsers(): Promise<void> {
    setLoading(true);
    try {
      const [utilisateurs, catalogueRoles] = await Promise.all([
        listUsers(),
        listRoles(),
      ]);
      setUsers(utilisateurs);
      setRoles(catalogueRoles);
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, "Impossible de charger les utilisateurs."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function charger(): Promise<void> {
      if (role === "ADMINISTRATEUR") await loadUsers();
    }
    void charger();
  }, [role]);

  useEffect(() => {
    async function chargerPermissions(): Promise<void> {
      if (selected === null) return;
      try {
        setPermissions(await getUserPermissions(selected.id));
      } catch (cause) {
        setError(
          errorMessage(cause, "Impossible de charger les permissions."),
        );
      }
    }
    void chargerPermissions();
  }, [selected]);

  if (role !== "ADMINISTRATEUR") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
        Accès réservé aux administrateurs.
      </div>
    );
  }

  function openCreate(): void {
    setForm(emptyForm);
    setCreating(true);
  }

  function openEdit(user: ManagedUser): void {
    setForm({
      nom: user.nom,
      email: user.email ?? "",
      roles: user.roles,
    });
    setEditing(user);
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing === null) await createUser(form);
      else await updateUser(editing.id, form);
      setCreating(false);
      setEditing(null);
      await loadUsers();
    } catch (cause) {
      setError(errorMessage(cause, "Impossible d’enregistrer l’utilisateur."));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (deleting === null) return;
    setSaving(true);
    try {
      await deleteUser(deleting.id);
      if (selected?.id === deleting.id) setSelected(null);
      setDeleting(null);
      await loadUsers();
    } catch (cause) {
      setError(errorMessage(cause, "Impossible de supprimer l’utilisateur."));
    } finally {
      setSaving(false);
    }
  }

  async function changePermission(
    permission: EffectivePermission,
    autorisee: boolean,
  ): Promise<void> {
    if (selected === null) return;
    try {
      await setUserPermission(selected.id, permission.code, autorisee);
      setPermissions(await getUserPermissions(selected.id));
    } catch (cause) {
      setError(errorMessage(cause, "Impossible de modifier la permission."));
    }
  }

  async function restorePermission(
    permission: EffectivePermission,
  ): Promise<void> {
    if (selected === null) return;
    try {
      await resetUserPermission(selected.id, permission.code);
      setPermissions(await getUserPermissions(selected.id));
    } catch (cause) {
      setError(errorMessage(cause, "Impossible de restaurer la permission."));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Gestion des utilisateurs
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Préenregistrer les comptes Keycloak et gérer leurs permissions.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => void loadUsers()}>
            <RefreshCw size={16} /> Actualiser
          </button>
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={16} /> Nouvel utilisateur
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,1fr)]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {loading ? (
            <div className="p-6 text-sm text-slate-500">Chargement...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Utilisateur</th>
                    <th className="px-4 py-3">Rôle</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className={
                        selected?.id === user.id ? "bg-blue-50" : undefined
                      }
                    >
                      <td className="px-4 py-3">
                        <button
                          className="text-left"
                          onClick={() => setSelected(user)}
                        >
                          <div className="font-semibold text-slate-900">
                            {user.nom}
                          </div>
                          <div className="text-xs text-slate-500">
                            {user.email ?? "Email non renseigné"}
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {user.roles.join(", ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                            title="Modifier"
                            onClick={() => openEdit(user)}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                            title="Supprimer"
                            onClick={() => setDeleting(user)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <ShieldCheck size={18} />
              Permissions
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {selected
                ? `Permissions effectives de ${selected.nom}`
                : "Sélectionnez un utilisateur."}
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {permissions.map((permission) => (
              <div
                key={permission.id}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-800">
                    {permission.libelle}
                  </div>
                  <div className="text-xs text-slate-400">
                    {permission.personnalisee ? "Personnalisée" : "Par défaut"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={permission.autorisee}
                    onChange={(event) =>
                      void changePermission(permission, event.target.checked)
                    }
                  />
                  {permission.personnalisee && (
                    <button
                      className="text-xs text-slate-500 underline"
                      onClick={() => void restorePermission(permission)}
                    >
                      Défaut
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal
        open={creating || editing !== null}
        title={
          editing === null ? "Créer un utilisateur" : "Modifier l’utilisateur"
        }
        description="L’email doit correspondre à l’utilisateur Keycloak."
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        width="max-w-lg"
      >
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <label className="block text-sm font-semibold text-slate-700">
            Nom
            <input
              className="input mt-1 w-full"
              required
              value={form.nom}
              onChange={(event) =>
                setForm({ ...form, nom: event.target.value })
              }
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Email Keycloak
            <input
              className="input mt-1 w-full"
              type="email"
              required
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Rôles
            <div className="mt-2 grid grid-cols-2 gap-2">
              {roles.map((option) => (
                <label key={option.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.roles.includes(option.code)}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        roles: event.target.checked
                          ? [...form.roles, option.code]
                          : form.roles.filter((role) => role !== option.code),
                      })
                    }
                  />
                  {option.libelle}
                </label>
              ))}
            </div>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Annuler
            </button>
            <button className="btn-primary" disabled={saving}>
              Enregistrer
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        message={`Supprimer ${deleting?.nom ?? "cet utilisateur"} ?`}
        confirmDisabled={saving}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
