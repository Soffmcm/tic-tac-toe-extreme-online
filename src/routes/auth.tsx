import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/game/Header";
import { supabase } from "@/integrations/supabase/client";
import { setStoredNickname } from "@/lib/identity";
import { toast } from "sonner";

interface AuthSearch {
  mode: "signin" | "signup";
}

export const Route = createFileRoute("/auth")({
  validateSearch: (search): AuthSearch => ({
    mode: search.mode === "signup" ? "signup" : "signin",
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Ultimate 3T" },
      {
        name: "description",
        content: "Sign in to track your wins and losses in Ultimate Tic-Tac-Toe.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/profile" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { nickname: nickname.trim() || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (nickname.trim()) setStoredNickname(nickname.trim());
        toast.success("Account created! You're in.");
        navigate({ to: "/profile" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate({ to: "/profile" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card rounded-3xl shadow-pop border border-border p-6 sm:p-8">
          <h1 className="font-display text-3xl font-bold text-center mb-2">
            {mode === "signup" ? "Create an account" : "Welcome back"}
          </h1>
          <p className="text-sm text-muted-foreground text-center mb-6">
            {mode === "signup"
              ? "Track your wins and play under your name."
              : "Sign in to your Ultimate 3T account."}
          </p>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="nick">Nickname</Label>
                <Input
                  id="nick"
                  value={nickname}
                  maxLength={20}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. Sunny Otter"
                  className="mt-1 rounded-xl"
                />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 rounded-xl"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={busy}
              className="w-full rounded-2xl font-bold h-12"
            >
              {busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>

          <div className="text-center mt-5 text-sm text-muted-foreground">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <Link
                  to="/auth"
                  search={{ mode: "signin" }}
                  className="text-primary font-semibold hover:underline"
                >
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New here?{" "}
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  className="text-primary font-semibold hover:underline"
                >
                  Create an account
                </Link>
              </>
            )}
          </div>

          <div className="text-center mt-4 text-xs text-muted-foreground">
            Or just{" "}
            <Link to="/play/online" className="text-primary font-semibold hover:underline">
              play as a guest
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
