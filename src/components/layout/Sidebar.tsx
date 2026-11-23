import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Camera,
  ChevronDown,
  ClipboardCheck,
  LogOut,
  Menu,
  PanelLeftClose,
  Settings,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
  Receipt,
  Sparkles,
  ClipboardPlus,
  ClipboardList,
  WalletCards,
  X,
  LayoutDashboard,
  ChartNoAxesCombined,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import logo from "../../assets/logo.jpg";
import { useAuth } from "../../features/auth";
import NotificationBell from "../../features/notifications/components/NotificationBell";
import {
  fetchProfilePhoto,
  updateProfile,
  uploadProfilePhoto,
} from "../../features/auth/services/auth";
import { IMAGE_ACCEPT, validateImageFile } from "../../utils/image";

type NavLinkEntry = {
  to: string;
  label: string;
  icon: LucideIcon;
  permission: string;
};
type NavSectionEntry = { section: string };
type NavEntry = NavLinkEntry | NavSectionEntry;

const nav: NavEntry[] = [
  { to: "/tableau-de-bord", label: "Tableau de bord", icon: LayoutDashboard, permission: "reporting.read" },
  { section: "Gestion" },
  { to: "/agents", label: "Agents", icon: Users, permission: "agents.read" },
  { to: "/beneficiaires", label: "Bénéficiaires", icon: UserRound, permission: "beneficiaries.read" },
  { to: "/prestataires", label: "Prestataires", icon: Stethoscope, permission: "providers.read" },
  { to: "/pec", label: "Prises en charge", icon: ShieldCheck, permission: "attestations.read" },
  { to: "/factures", label: "Factures", icon: Receipt, permission: "invoices.read" },
  { to: "/statistiques", label: "Statistiques", icon: ChartNoAxesCombined, permission: "reporting.read" },
  { to: "/assistant", label: "Assistant global", icon: Sparkles, permission: "assistant.use" },
  { to: "/factures/t6", label: "Détail des frais médicaux", icon: ClipboardPlus, permission: "t6.read" },
  { to: "/paie", label: "Retenue sur salaire", icon: WalletCards, permission: "payroll.read" },
  { to: "/actes-prestations", label: "Actes et prestations", icon: ClipboardPlus, permission: "reference-data.read" },
  { section: "Paramétrage" },
  { to: "/referentiels", label: "Référentiels", icon: Settings, permission: "reference-data.read" },
  { to: "/utilisateurs", label: "Utilisateurs", icon: Users, permission: "admin.manage" },
  { to: "/roles", label: "Rôles et permissions", icon: ShieldCheck, permission: "admin.manage" },
  { to: "/audit", label: "Audit et sessions", icon: ClipboardList, permission: "audit.read" },
  {
    to: "/demandes-suppression",
    label: "Demandes de suppression",
    icon: ClipboardCheck,
    permission: "deletions.manage",
  },
];

export default function Sidebar({ children }: { children: React.ReactNode }) {
  const { user, logout, refreshUser, theme, setTheme, hasPermission } = useAuth();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [accountView, setAccountView] = useState<
    "overview" | "profile" | "preferences"
  >("overview");
  const [profileName, setProfileName] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<{
    userId: number;
    url: string;
  } | null>(null);
  const [photoReloadKey, setPhotoReloadKey] = useState(0);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const location = useLocation();
  const current =
    nav
      .filter((entry): entry is NavLinkEntry => "to" in entry)
      .find((entry) => entry.to === location.pathname)?.label ?? "Accueil";
  const displayName = user?.nom ?? user?.email ?? "Utilisateur";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .filter((initial): initial is string => initial !== undefined)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const profilePhotoUrl =
    profilePhoto?.userId === user?.id ? profilePhoto.url : null;
  const profileUserId = user?.id;
  const title =
    accountView === "profile"
      ? "Modifier mon profil"
      : accountView === "preferences"
        ? "Préférences d’interface"
        : "Mon profil";

  useEffect(() => {
    if (!user?.hasPhoto || profileUserId === undefined) return;

    let active = true;
    let objectUrl: string | null = null;
    void fetchProfilePhoto()
      .then((photo) => {
        objectUrl = URL.createObjectURL(photo);
        if (active) setProfilePhoto({ userId: profileUserId, url: objectUrl });
        else URL.revokeObjectURL(objectUrl);
      })
      .catch((cause: unknown) => {
        if (active) {
          setProfileError(
            cause instanceof Error
              ? cause.message
              : "Impossible de charger la photo de profil.",
          );
        }
      });

    return () => {
      active = false;
      if (objectUrl !== null) URL.revokeObjectURL(objectUrl);
    };
  }, [user?.hasPhoto, profileUserId, photoReloadKey]);

  async function saveProfile(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const nom = profileName.trim();
    if (!nom) {
      setProfileError("Le nom affiché est obligatoire.");
      return;
    }
    setSavingProfile(true);
    setProfileError(null);
    setProfileMessage(null);
    try {
      await updateProfile(nom);
      await refreshUser();
      setProfileMessage("Le profil a été mis à jour.");
    } catch (cause: unknown) {
      setProfileError(
        cause instanceof Error ? cause.message : "La mise à jour a échoué.",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePhoto(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const input = event.currentTarget;
    const image = input.files?.[0];
    if (!image) return;
    const validationError = validateImageFile(image);
    if (validationError) {
      setProfileError(validationError);
      input.value = "";
      return;
    }

    setUploadingPhoto(true);
    setProfileError(null);
    setProfileMessage(null);
    try {
      await uploadProfilePhoto(image);
      await refreshUser();
      setPhotoReloadKey((key) => key + 1);
      setProfileMessage("La photo de profil a été mise à jour.");
    } catch (cause: unknown) {
      setProfileError(
        cause instanceof Error ? cause.message : "L’envoi de la photo a échoué.",
      );
    } finally {
      setUploadingPhoto(false);
      input.value = "";
    }
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? "bg-red-50 text-red-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`;

  return (
    <div className="min-h-screen bg-slate-50">
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "lg:w-[82px]" : ""}`}
      >
        <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-5">
          <img
            src={logo}
            alt="Caisse d'Épargne de Madagascar"
            className="h-10 w-auto max-w-[185px] object-contain object-left"
          />
          <button
            className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-100 lg:hidden"
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <div
            className={`mb-3 px-3 pt-2 text-[10px] font-extrabold uppercase tracking-[.18em] text-slate-400 ${collapsed ? "lg:hidden" : ""}`}
          >
            Navigation
          </div>
          <nav className="space-y-1">
            {nav.map((item, idx) => {
              if ("section" in item) {
                const nextSection = nav.findIndex(
                  (entry, entryIndex) =>
                    entryIndex > idx && "section" in entry,
                );
                const end = nextSection < 0 ? nav.length : nextSection;
                const hasVisibleLink = nav
                  .slice(idx + 1, end)
                  .some(
                    (entry) =>
                      "to" in entry && hasPermission(entry.permission),
                  );
                return hasVisibleLink ? (
                  <div
                    key={`section-${idx}`}
                    className={`px-3 pb-2 pt-5 text-[10px] font-extrabold uppercase tracking-[.18em] text-slate-400 ${collapsed ? "lg:hidden" : ""}`}
                  >
                    {item.section}
                  </div>
                ) : null;
              }
              if (!hasPermission(item.permission)) return null;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  onClick={() => setOpen(false)}
                  end={item.to === "/factures"}
                  className={linkClass}
                >
                  <item.icon size={18} className="shrink-0" />
                  <span className={`${collapsed ? "lg:hidden" : ""}`}>
                    {item.label}
                  </span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </aside>

      <div
        className={`min-h-screen transition-[padding] duration-200 ${collapsed ? "lg:pl-[82px]" : "lg:pl-[270px]"}`}
      >
        <header className="sticky top-0 z-20 flex h-20 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
          <button
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu size={21} />
          </button>
          <button
            className="hidden rounded-xl p-2 text-slate-500 hover:bg-slate-100 lg:block"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <Menu size={20} /> : <PanelLeftClose size={20} />}
          </button>
          <div className="hidden items-center gap-2 text-xs text-slate-400 md:flex">
            <span>Frais médicaux</span>
            <span>/</span>
            <span className="font-bold text-slate-700">{current}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {hasPermission("notifications.read") && <NotificationBell />}
            <button
              onClick={() => {
                setAccountView("overview");
                setProfileError(null);
                setProfileMessage(null);
                setProfileOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl p-1.5 pr-2.5 hover:bg-slate-50"
              aria-label="Ouvrir mon compte"
            >
              <ProfileAvatar
                photoUrl={profilePhotoUrl}
                initials={initials}
                className="h-9 w-9 bg-red-100 text-xs text-red-700"
              />
              <span className="hidden max-w-44 truncate text-sm font-bold text-slate-700 md:block">
                {displayName}
              </span>
              <ChevronDown
                size={15}
                className="hidden text-slate-400 sm:block"
              />
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
      <Modal
        open={profileOpen}
        title={title}
        description={
          accountView === "preferences"
            ? "Choisissez votre thème d’affichage."
            : accountView === "profile"
              ? "Modifiez votre nom affiché et votre photo."
              : "Compte actuellement connecté"
        }
        onClose={() => {
          setProfileOpen(false);
          setAccountView("overview");
        }}
        width="max-w-md"
      >
        {accountView === "overview" && (
          <>
            <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
              <ProfileAvatar
                photoUrl={profilePhotoUrl}
                initials={initials}
                className="h-14 w-14 bg-slate-900 text-lg text-white"
              />
              <div className="min-w-0">
                <div className="truncate font-bold text-slate-900">
                  {displayName}
                </div>
                <div className="text-sm text-slate-500">
                  {user?.roles.join(", ") || "Utilisateur"}
                </div>
                <div className="mt-1 truncate text-xs text-slate-400">
                  {user?.email}
                </div>
              </div>
            </div>
            <div className="mt-6 grid gap-2">
              <button
                className="btn-secondary justify-start"
                onClick={() => {
                  setProfileName(user?.nom ?? "");
                  setProfileError(null);
                  setProfileMessage(null);
                  setAccountView("profile");
                }}
              >
                <UserRound size={17} /> Modifier mon profil
              </button>
              <button
                className="btn-secondary justify-start"
                onClick={() => setAccountView("preferences")}
              >
                <Settings size={17} /> Préférences d’interface
              </button>
              <button
                onClick={() => void logout()}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                <LogOut size={17} /> Se déconnecter
              </button>
            </div>
          </>
        )}
        {accountView === "profile" && (
          <form className="grid gap-4" onSubmit={(event) => void saveProfile(event)}>
            <button
              type="button"
              className="btn-ghost justify-self-start"
              onClick={() => setAccountView("overview")}
            >
              Retour au compte
            </button>
            <label className="label">
              Nom affiché
              <input
                className="field mt-1"
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                maxLength={120}
                required
              />
            </label>
            <div className="grid gap-2">
              <span className="label mb-0">Photo de profil</span>
              <div className="flex items-center gap-3">
                <ProfileAvatar
                  photoUrl={profilePhotoUrl}
                  initials={initials}
                  className="h-14 w-14 bg-slate-900 text-lg text-white"
                />
                <label className="btn-secondary">
                  <Camera size={17} />
                  {uploadingPhoto ? "Envoi…" : "Choisir une photo"}
                  <input
                    className="sr-only"
                    type="file"
                    accept={IMAGE_ACCEPT}
                    onChange={(event) => void changePhoto(event)}
                    disabled={uploadingPhoto}
                  />
                </label>
              </div>
              <p className="text-xs text-slate-400">
                JPEG, PNG ou WEBP — 2 Mo maximum.
              </p>
            </div>
            {profileError && (
              <p className="text-sm text-red-600" role="alert">
                {profileError}
              </p>
            )}
            {profileMessage && (
              <p className="text-sm text-emerald-700" role="status">
                {profileMessage}
              </p>
            )}
            <button className="btn-primary" type="submit" disabled={savingProfile}>
              {savingProfile ? "Enregistrement…" : "Enregistrer le nom"}
            </button>
          </form>
        )}
        {accountView === "preferences" && (
          <div className="grid gap-4">
            <button
              type="button"
              className="btn-ghost justify-self-start"
              onClick={() => setAccountView("overview")}
            >
              Retour au compte
            </button>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                aria-pressed={theme === "light"}
                className={`btn-secondary justify-start ${theme === "light" ? "border-red-300 bg-red-50 text-red-700" : ""}`}
                onClick={() => setTheme("light")}
              >
                <Sun size={17} /> Clair
              </button>
              <button
                type="button"
                aria-pressed={theme === "dark"}
                className={`btn-secondary justify-start ${theme === "dark" ? "border-red-300 bg-red-50 text-red-700" : ""}`}
                onClick={() => setTheme("dark")}
              >
                <Moon size={17} /> Sombre
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function ProfileAvatar({
  photoUrl,
  initials,
  className,
}: {
  photoUrl: string | null;
  initials: string;
  className: string;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full font-extrabold ${className}`}
    >
      {photoUrl ? (
        <img src={photoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}
