import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Modal } from "../components/ui/Modal";
import { useAuth } from "../features/auth";
import {
  createRole,
  deleteRole,
  getRolePermissions,
  listRoles,
  resetRolePermission,
  setRolePermission,
  updateRole,
  type EffectivePermission,
  type ManagedRole,
} from "../features/users/services/users";
import { errorMessage } from "../utils/errors";

const emptyForm = { code: "", libelle: "" };

export default function RoleManagementPage() {
  const { role } = useAuth();
  const [roles, setRoles] = useState<ManagedRole[]>([]);
  const [selected, setSelected] = useState<ManagedRole | null>(null);
  const [permissions, setPermissions] = useState<EffectivePermission[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<ManagedRole | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ManagedRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadRoles(): Promise<void> {
    try {
      setRoles(await listRoles());
      setError(null);
    } catch (cause) {
      setError(errorMessage(cause, "Impossible de charger les rôles."));
    }
  }

  useEffect(() => {
    async function charger(): Promise<void> {
      if (role === "ADMINISTRATEUR") await loadRoles();
    }
    void charger();
  }, [role]);

  useEffect(() => {
    async function chargerPermissions(): Promise<void> {
      if (selected === null) return;
      try {
        setPermissions(await getRolePermissions(selected.id));
      } catch (cause) {
        setError(errorMessage(cause, "Impossible de charger les permissions."));
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
    setEditing(null);
    setCreating(true);
  }

  function openEdit(item: ManagedRole): void {
    setForm({ code: item.code, libelle: item.libelle });
    setEditing(item);
    setCreating(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    try {
      if (editing === null) {
        await createRole(form);
      } else {
        await updateRole(editing.id, { libelle: form.libelle });
      }
      setCreating(false);
      setEditing(null);
      await loadRoles();
    } catch (cause) {
      setError(errorMessage(cause, "Impossible d’enregistrer le rôle."));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (deleting === null) return;
    setSaving(true);
    try {
      await deleteRole(deleting.id);
      if (selected?.id === deleting.id) setSelected(null);
      setDeleting(null);
      await loadRoles();
    } catch (cause) {
      setError(errorMessage(cause, "Impossible de supprimer le rôle."));
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
      await setRolePermission(selected.id, permission.code, autorisee);
      setPermissions(await getRolePermissions(selected.id));
    } catch (cause) {
      setError(errorMessage(cause, "Impossible de modifier la permission."));
    }
  }

  async function restorePermission(permission: EffectivePermission): Promise<void> {
    if (selected === null) return;
    try {
      await resetRolePermission(selected.id, permission.code);
      setPermissions(await getRolePermissions(selected.id));
    } catch (cause) {
      setError(errorMessage(cause, "Impossible de restaurer la permission."));
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Rôles et permissions
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Configurez les permissions par défaut de chaque rôle.
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={openCreate}>
          <Plus size={16} /> Nouveau rôle
        </button>
      </div>

      {error !== null && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5 font-bold text-slate-900">
            Rôles
          </div>
          <div className="divide-y divide-slate-100">
            {roles.map((item) => (
              <div
                key={item.id}
                className={`flex items-center justify-between p-4 ${selected?.id === item.id ? "bg-blue-50" : ""}`}
              >
                <button className="text-left" onClick={() => setSelected(item)}>
                  <div className="font-semibold text-slate-900">{item.libelle}</div>
                  <div className="text-xs text-slate-400">{item.code}</div>
                </button>
                <div className="flex gap-1">
                  <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => openEdit(item)}>
                    <Pencil size={16} />
                  </button>
                  {!item.systeme && (
                    <button className="rounded-lg p-2 text-red-600 hover:bg-red-50" onClick={() => setDeleting(item)}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-5">
            <div className="flex items-center gap-2 font-bold text-slate-900">
              <ShieldCheck size={18} />
              Permissions
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {selected?.libelle ?? "Sélectionnez un rôle."}
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {permissions.map((permission) => (
              <div key={permission.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="text-sm font-semibold text-slate-800">{permission.libelle}</div>
                  <div className="text-xs text-slate-400">
                    {permission.personnalisee ? "Configurée" : "Non configurée"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={permission.autorisee}
                    disabled={selected?.systeme === true}
                    onChange={(event) => void changePermission(permission, event.target.checked)}
                  />
                  {permission.personnalisee && selected?.systeme !== true && (
                    <button className="text-xs text-slate-500 underline" onClick={() => void restorePermission(permission)}>
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
        title={editing === null ? "Créer un rôle" : "Modifier le rôle"}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        width="max-w-lg"
      >
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          <label className="block text-sm font-semibold text-slate-700">
            Code
            <input
              className="input mt-1 w-full uppercase"
              required
              disabled={editing !== null}
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value })}
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Libellé
            <input
              className="input mt-1 w-full"
              required
              value={form.libelle}
              onChange={(event) => setForm({ ...form, libelle: event.target.value })}
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => { setCreating(false); setEditing(null); }}>
              Annuler
            </button>
            <button className="btn-primary" disabled={saving}>Enregistrer</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        message={`Supprimer le rôle ${deleting?.libelle ?? ""} ?`}
        confirmDisabled={saving}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
