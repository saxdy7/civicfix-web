import { useEffect, useState } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { ScreenContainer } from "../components/ScreenContainer";
import { TextField } from "../components/TextField";
import { useAuth } from "../lib/auth-context";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { color, fontFamily, fontSize, radius, spacing } from "../lib/theme";

const ROLES = [
  { key: "field_worker", title: "Field worker", hint: "Accept assignments, capture evidence" },
  { key: "department_manager", title: "Dept. manager", hint: "Triage, route and assign" },
];

interface Department {
  id: string;
  name: string;
}

export default function StaffRequestAccess() {
  const router = useRouter();
  const { user } = useAuth();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [fullName, setFullName] = useState(user?.name ?? "");
  const [workEmail, setWorkEmail] = useState(user?.email ?? "");
  const [employeeId, setEmployeeId] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [role, setRole] = useState(ROLES[0].key);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from("departments")
      .select("id, name")
      .order("name")
      .then(({ data }) => setDepartments(data ?? []));
  }, []);

  useEffect(() => {
    if (departments.length > 0 && !departmentId) setDepartmentId(departments[0].id);
  }, [departments, departmentId]);

  if (!user) {
    return (
      <ScreenContainer edges={["left", "right"]}>
        <Text style={styles.title}>Sign in first</Text>
        <Text style={styles.body}>
          A staff access request is tied to your account — sign in or create one, then come back
          here.
        </Text>
        <Button label="Sign in" onPress={() => router.push("/sign-in")} />
        <Button
          label="Create an account"
          variant="secondary"
          onPress={() => router.push({ pathname: "/sign-in", params: { mode: "sign-up" } })}
        />
      </ScreenContainer>
    );
  }

  const departmentName = departments.find((d) => d.id === departmentId)?.name ?? "your department";

  const handleSubmit = async () => {
    if (fullName.trim().length < 2) return setError("Enter your full name.");
    if (!workEmail.includes("@")) return setError("Enter your work email address.");
    if (employeeId.trim().length < 3) return setError("Enter your employee ID.");
    if (!departmentId) return setError("Choose a department.");
    if (!agreed) return setError("You must accept the staff terms to request access.");

    setError(null);
    setSubmitting(true);

    if (!supabase || !isSupabaseConfigured) {
      setError("Requesting access isn't available in demo mode — Supabase isn't configured.");
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from("staff_access_requests").insert({
      user_id: user.id,
      full_name: fullName.trim(),
      work_email: workEmail.trim(),
      employee_id: employeeId.trim(),
      department_id: departmentId,
      requested_role: role,
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.code === "23505" ? "You already have a pending request." : insertError.message);
      return;
    }

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <ScreenContainer edges={["left", "right"]}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark" size={32} color={color.inverseForeground} />
        </View>
        <Text style={styles.title}>Request received</Text>
        <Text style={styles.body}>
          An administrator will verify your employee ID against the {departmentName} roster and
          grant your role from the admin console. You'll be able to sign in with staff access once
          approved — this same account, same app.
        </Text>
        <Button label="Back to profile" onPress={() => router.replace("/(tabs)/profile")} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["left", "right"]}>
      <Text style={styles.title}>Request staff access</Text>
      <Text style={styles.body}>
        For municipal employees only. Staff roles are never self-assigned — an administrator
        verifies and grants access.
      </Text>

      <TextField label="Full name" placeholder="Your name" autoCapitalize="words" value={fullName} onChangeText={setFullName} />
      <TextField
        label="Work email"
        placeholder="you@municipality.gov"
        autoCapitalize="none"
        keyboardType="email-address"
        value={workEmail}
        onChangeText={setWorkEmail}
      />
      <TextField label="Employee ID" placeholder="e.g. SR-40912" value={employeeId} onChangeText={setEmployeeId} />

      <View style={styles.field}>
        <Text style={styles.label}>Department</Text>
        {departments.length === 0 ? (
          <Text style={styles.hint}>Loading departments…</Text>
        ) : (
          <View style={styles.chipRow}>
            {departments.map((d) => {
              const active = departmentId === d.id;
              return (
                <Pressable
                  key={d.id}
                  onPress={() => setDepartmentId(d.id)}
                  style={[styles.chip, active && styles.chipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{d.name}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Requested role</Text>
        <View style={styles.roleGrid}>
          {ROLES.map((r) => {
            const active = role === r.key;
            return (
              <Pressable
                key={r.key}
                onPress={() => setRole(r.key)}
                style={[styles.roleCard, active && styles.roleCardActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.roleTitle, active && styles.roleTitleActive]}>{r.title}</Text>
                <Text style={[styles.roleHint, active && styles.roleHintActive]}>{r.hint}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable style={styles.termsRow} onPress={() => setAgreed((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }}>
        <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
          {agreed ? <Ionicons name="checkmark" size={14} color={color.inverseForeground} /> : null}
        </View>
        <Text style={styles.termsText}>
          I confirm I am an employee of this municipality and accept that every privileged action I
          take is permanently audit-logged.
        </Text>
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Button label={submitting ? "Submitting…" : "Submit request"} size="hero" disabled={submitting} onPress={handleSubmit} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.bold,
    color: color.foreground,
  },
  body: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
    lineHeight: 20,
  },
  field: {
    gap: spacing[2],
  },
  label: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
    color: color.foreground,
  },
  hint: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[2],
  },
  chip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.pill,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  chipActive: {
    backgroundColor: color.inverseBackground,
    borderColor: color.inverseBackground,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    color: color.foreground,
  },
  chipTextActive: {
    color: color.inverseForeground,
  },
  roleGrid: {
    flexDirection: "row",
    gap: spacing[2],
  },
  roleCard: {
    flex: 1,
    padding: spacing[3],
    borderRadius: radius.card,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    gap: 2,
  },
  roleCardActive: {
    backgroundColor: color.inverseBackground,
    borderColor: color.inverseBackground,
  },
  roleTitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
    color: color.foreground,
  },
  roleTitleActive: {
    color: color.inverseForeground,
  },
  roleHint: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
  },
  roleHintActive: {
    color: color.inverseForeground,
    opacity: 0.7,
  },
  termsRow: {
    flexDirection: "row",
    gap: spacing[3],
    alignItems: "flex-start",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: color.civicBlue,
    borderColor: color.civicBlue,
  },
  termsText: {
    flex: 1,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
    lineHeight: 18,
  },
  errorText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    color: color.civicRed,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: color.civicGreen,
    alignItems: "center",
    justifyContent: "center",
  },
});
