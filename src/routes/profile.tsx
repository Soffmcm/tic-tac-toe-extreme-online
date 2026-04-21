import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, Trophy } from "lucide-react";
import { Header } from "@/components/game/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { setStoredNickname } from "@/lib/identity";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Ultimate 3T" },
      { name: "description", content: "Your Ultimate Tic-Tac-Toe stats and nickname." },
    ],
  }),
  component: Profile,
});

interface ProfileRow {
  id: string;
  nickname: string;
  wins: number;
  losses: number;
  draws: number;
}

function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [email, setEmail] = useState<string>("");
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;
      if (!u) {
        navigate({ to: "/auth", search: { mode: "signin" } });
        return;
      }
      setEmail(u.email ?? "");
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .maybeSingle();
      if (p) {
        setProfile(p as ProfileRow);
        setNickname(p.nickname);
      }
      setLoading(false);
    })();
  }, [navigate]);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nickname: nickname.trim() || "Player" })
      .eq("id", profile.id);
    if (error) {
      toast.error(error.message);
    } else {
      setStoredNickname(nickname.trim() || "Player");
      toast.success("Saved!");
    }
    setSaving(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center text-muted-foreground">
          Loading…
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-2">
              <Trophy className="size-5 text-primary" />
              <span className="font-display font-bold uppercase text-xs tracking-widest text-muted-foreground">
                Profile
              </span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold">
              {profile?.nickname || "Player"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{email}</p>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <StatCard label="Wins" value={profile?.wins ?? 0} className="bg-player-x-soft text-player-x" />
            <StatCard label="Losses" value={profile?.losses ?? 0} className="bg-muted text-muted-foreground" />
            <StatCard label="Draws" value={profile?.draws ?? 0} className="bg-player-o-soft text-player-o" />
          </div>

          <div className="bg-card rounded-3xl p-6 shadow-pop border border-border">
            <Label htmlFor="nick" className="text-xs font-bold uppercase text-foreground/60">
              Nickname
            </Label>
            <Input
              id="nick"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              className="mt-1 mb-4 rounded-xl text-base font-bold"
            />
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving} className="rounded-2xl font-bold">
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button asChild variant="secondary" className="rounded-2xl font-bold">
                <Link to="/play/online">Play online</Link>
              </Button>
              <Button onClick={signOut} variant="ghost" className="rounded-2xl font-bold ml-auto">
                <LogOut className="!size-4" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  className = "",
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl p-4 text-center shadow-pop ${className}`}>
      <div className="font-display text-3xl font-bold">{value}</div>
      <div className="text-xs uppercase tracking-wide font-bold opacity-70">{label}</div>
    </div>
  );
}
