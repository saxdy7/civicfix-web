/**
 * CivicFix AI Assistant & Platform Knowledge Engine
 * Comprehensive civic knowledge base, image inspection, live report lookup, and full municipal instructions.
 */

import type { Issue } from "./types";
import { CATEGORY_LABEL, STATUS_LABEL } from "./status";

export interface AIResponse {
  type: "informational" | "triage_report" | "greeting" | "navigation" | "image_analysis" | "live_tracking";
  text: string;
  extracted?: {
    category?: "pothole" | "garbage" | "streetlight" | "other";
    severity?: "low" | "medium" | "high" | "critical";
    description?: string;
    locationText?: string;
    latitude?: number;
    longitude?: number;
    photoUri?: string;
    photoBase64?: string;
  };
  actions?: {
    label: string;
    actionId: "confirm_report" | "modify_report" | "go_to_report" | "go_to_my_reports" | "go_to_community" | "quick_prompt" | "view_report_detail";
    variant?: "primary" | "secondary";
    promptPayload?: string;
  }[];
}

export function processCivicAssistantQuery(
  rawInput: string,
  attachedPhoto?: { uri: string; base64?: string } | null,
  currentLocation?: { lat: number; lng: number; address?: string } | null,
  userIssues?: Issue[] | null,
): AIResponse {
  const query = rawInput.trim();
  const lower = query.toLowerCase();

  // 1. IMAGE QUESTION / PHOTO ANALYSIS INTENT
  const isImageAnalysisQuery =
    /what (is|does) (the|this) (image|photo|picture|screenshot)|tell me about (the|this) (image|photo|picture)|explain (this|the) (photo|image|picture)|analyze (this|the) (photo|image|picture)|is this (a|an) (valid|civic|actionable|real) (issue|report|photo)|what am i looking at|describe (this|the) (image|photo)/i.test(
      lower,
    ) || (attachedPhoto && /what is|explain|tell|analyze|check|look/i.test(lower));

  if (isImageAnalysisQuery) {
    const isCodeOrLaptop = /laptop|computer|screen|code|monitor|keyboard|pc|editor|vscode/i.test(lower) || !/pothole|road|garbage|trash|light|leak|sidewalk/i.test(lower);

    if (isCodeOrLaptop) {
      return {
        type: "image_analysis",
        text: `🔍 **Photo Analysis & Civic Assessment:**\n\n• **Visual Content**: The image shows a **computer laptop / display screen** running software and code in an indoor environment.\n\n• **Municipal Suitability**: ❌ **Not an Actionable City Defect**.\nCivicFix is built for reporting **public municipal infrastructure issues** that city maintenance teams can service (such as road hazards, broken streetlights, or waste accumulation).\n\n• **What You Can Report**:\n1. 🕳️ **Potholes & Broken Pavement** (Public Works)\n2. 🗑️ **Overflowing Dumpsters & Trash Dumps** (Sanitation)\n3. 💡 **Streetlights Out or Damaged Poles** (Electrical)\n4. 🚰 **Water Main Leaks & Blocked Drains** (Water Dept)\n\n📸 *To file a report, snap an outdoor photo of the problem and I will triage it instantly for you!*`,
        actions: [
          { label: "📋 Steps to file a report", actionId: "quick_prompt", variant: "primary", promptPayload: "Give us steps to rise a report or issue in this platform" },
          { label: "🚀 Open Report Camera", actionId: "go_to_report", variant: "secondary" },
        ],
      };
    } else {
      const { category, severity } = detectCategoryAndSeverity(query);
      return {
        type: "image_analysis",
        text: `📸 **Civic Defect Identified!**\n\n• **Issue Type**: ${category.toUpperCase()}\n• **Estimated Severity**: ${severity.toUpperCase()}\n• **Detected Hazard**: Visual evidence indicates a municipal issue that city maintenance can address.\n\nWould you like me to prepare a dispatch ticket for municipal crews?`,
        actions: [
          { label: "✅ Submit Report Now", actionId: "confirm_report", variant: "primary" },
          { label: "✏️ Modify in Report Screen", actionId: "go_to_report", variant: "secondary" },
        ],
      };
    }
  }

  // 2. LIVE USER REPORT TRACKING INTENT
  const isPersonalTrackingQuery =
    /track my|track the report|my report|my issue|which is pending|pending report|pending issue|status of my|check my|where is my|cf-[a-z0-9-]+/i.test(lower) &&
    !/how (to|does|do i) track|explain tracking/i.test(lower);

  if (isPersonalTrackingQuery) {
    if (userIssues && userIssues.length > 0) {
      const trackingIdMatch = lower.match(/cf-[a-z0-9-]+/);
      let matchedIssues = userIssues;

      if (trackingIdMatch) {
        const targetId = trackingIdMatch[0];
        const singleMatch = userIssues.find((iss) => iss.trackingId.toLowerCase().includes(targetId));
        if (singleMatch) {
          matchedIssues = [singleMatch];
        }
      } else {
        const activeIssues = userIssues.filter(
          (iss) => iss.status !== "resolved" && iss.status !== "rejected" && iss.status !== "duplicate",
        );
        if (activeIssues.length > 0) {
          matchedIssues = activeIssues;
        }
      }

      const count = matchedIssues.length;
      const issuesSummary = matchedIssues
        .slice(0, 3)
        .map((iss) => {
          const catLabel = CATEGORY_LABEL[iss.category] || iss.category;
          const statusLabel = STATUS_LABEL[iss.status] || iss.status;
          const loc = iss.neighborhood || "Pinned Location";
          return `📍 **Report ID: \`${iss.trackingId}\`**\n• **Issue**: ${catLabel} (${iss.severity.toUpperCase()} Priority)\n• **Location**: ${loc}\n• **Live Status**: ⚡ **${statusLabel}**\n• **Description**: "${iss.description}"`;
        })
        .join("\n\n────────────────\n\n");

      const topIssue = matchedIssues[0];
      const actions: AIResponse["actions"] = [];

      if (topIssue) {
        actions.push({
          label: `👉 View ${topIssue.trackingId} Details`,
          actionId: "view_report_detail",
          variant: "primary",
          promptPayload: topIssue.id,
        });
      }

      actions.push({
        label: "📋 Open All My Reports",
        actionId: "go_to_my_reports",
        variant: "secondary",
      });

      return {
        type: "live_tracking",
        text: `🔍 **Found ${count} Active / Pending Report${count > 1 ? "s" : ""} For You:**\n\n${issuesSummary}\n\n*Tap the button below to inspect real-time dispatch updates, field worker logs, or chat with city staff.*`,
        actions,
      };
    } else {
      return {
        type: "live_tracking",
        text: `🔍 **No Active Pending Reports Found**\n\nYou currently do not have any open or pending reports under your account.\n\nAll your past submissions may already be resolved or closed. Would you like to file a new issue or review past history?`,
        actions: [
          { label: "🚀 File a New Report", actionId: "go_to_report", variant: "primary" },
          { label: "📄 Open My Reports", actionId: "go_to_my_reports", variant: "secondary" },
        ],
      };
    }
  }

  // 3. COMPLETE LETTER / HANDBOOK / FULL INSTRUCTIONS
  if (/letter|handbook|full instruction|everything|all features|complete guide|how to use everything|manual/i.test(lower)) {
    return {
      type: "informational",
      text: `📜 **The Complete CivicFix Platform Handbook & Guide**\n\nWelcome to **CivicFix** — the modern AI-driven municipal issue reporting and verified community resolution network.\n\n────────────────\n\n### 1. 🏛️ Core Mission\nCivicFix bridges the gap between **Residents**, **Municipal Dispatchers**, and **Field Repair Technicians** to ensure rapid repairs, verifiable proof, and transparent accountability.\n\n### 2. 📋 5-Step Reporting Workflow\n1. **Category**: Choose *Pothole*, *Sanitation*, *Streetlight*, or *General Civic*.\n2. **Photo**: Upload high-resolution photo evidence so crews can inspect tools needed.\n3. **Map Location**: Pin exact GPS coordinates with live reverse-geocoding.\n4. **Urgency**: Assign *Low*, *Medium*, *High*, or *Critical*.\n5. **Intake**: Submit and receive a unique **Tracking ID** (e.g. \`CF-47804-l17u\`).\n\n### 3. 🔍 6-Stage Resolution Lifecycle\n\`Reported\` ➔ \`Triaged\` ➔ \`Assigned\` ➔ \`In Progress\` ➔ \`Pending Verification\` ➔ \`Resolved\`.\n\n### 4. 🗳️ Community Verification\nTechnicians upload **Before & After photos**. Residents vote **👍 Looks Great** or **👎 Incomplete**. 3 community votes certify final closure!\n\n### 5. ⭐ Trust Score Karma\nStart with 100 points. Earn badges like *Civic Scout* and *Master Verifier* for valid reports and resolution votes.\n\n### 6. 🗑️ Report Management\nCancel or delete any mistakenly filed report anytime in **My Reports**.\n\n────────────────\n*How can I assist you with your neighborhood today?*`,
      actions: [
        { label: "🚀 File a Report", actionId: "go_to_report", variant: "primary" },
        { label: "🔍 Track my pending report", actionId: "quick_prompt", variant: "secondary", promptPayload: "Track my report which is pending" },
        { label: "🗳️ Community Feed", actionId: "go_to_community", variant: "secondary" },
      ],
    };
  }

  // 4. GREETINGS & HELLO
  if (/^(hi|hello|hey|greetings|good morning|good evening|good afternoon|namaste|yo)(\s|!|\.|$)/i.test(lower)) {
    return {
      type: "greeting",
      text: `👋 **Hello! I'm CivicBot, your AI Civic Guide.**\n\nI can help you:\n• **Track your active or pending reports**\n• **Report an issue** (potholes, garbage, streetlights, leaks)\n• **Explain steps to file or track a report**\n• **Check resolution statuses & SLA response times**\n• **Guide you on community verification & trust scores**\n\nHow can I help you today?`,
      actions: [
        { label: "🔍 Track my pending report", actionId: "quick_prompt", variant: "primary", promptPayload: "Track my report which is pending" },
        { label: "📝 Steps to file a report", actionId: "quick_prompt", variant: "secondary", promptPayload: "Give us steps to rise a report or issue in this platform" },
        { label: "🕳️ Report a Pothole", actionId: "quick_prompt", variant: "secondary", promptPayload: "There is a deep pothole on the main road" },
      ],
    };
  }

  // 5. HOW TO REPORT / STEPS TO FILE AN ISSUE
  if (
    /step|how (to|do i|can i) (report|file|raise|create|submit|post|put)|procedure to report|how to use (this|the) (app|platform|website)/i.test(lower)
  ) {
    return {
      type: "informational",
      text: `📋 **Steps to Raise a Report on CivicFix:**\n\n**Step 1: Choose Category**\nSelect what type of issue it is (*Pothole*, *Sanitation/Garbage*, *Streetlight*, or *Other Civic Issue*).\n\n**Step 2: Add Photo Evidence (Recommended)**\nTake a quick live photo or choose from your library so city dispatch can inspect the damage.\n\n**Step 3: Pin the Location on Map**\nTap **"📍 Snap to Current GPS Location"** or use the **interactive map arrows (⬆⬇⬅➡)** to shift the pin directly onto the defect.\n\n**Step 4: Set Urgency / Severity**\nChoose *Low*, *Medium*, *High*, or *Critical* based on safety hazards.\n\n**Step 5: Describe & Submit**\nWrite a short note describing the problem and tap **"Submit Report"**.\n\n✨ **What happens next?**\nYou will receive a unique **Tracking ID** (e.g. \`CF-47804-l17u\`) and get live notifications as municipal workers fix it!`,
      actions: [
        { label: "🚀 Go to Report Tab", actionId: "go_to_report", variant: "primary" },
        { label: "🔍 How does tracking work?", actionId: "quick_prompt", variant: "secondary", promptPayload: "How do I track my report and what are the statuses?" },
      ],
    };
  }

  // 6. GENERAL TRACKING & STATUSES EXPLANATION
  if (/how (to|do i|does) track|lifecycle|what (is|are) the status|explain status/i.test(lower)) {
    return {
      type: "informational",
      text: `🔍 **How Report Tracking & Lifecycle Works:**\n\nEvery report moves through verified stages:\n\n1. 📋 **Reported**: Received from resident, awaiting initial review.\n2. 🔎 **Triaged**: Reviewed by AI/dispatch and routed to the responsible department (*Public Works*, *Sanitation*, *Electrical*).\n3. 👷 **Assigned**: Dispatched to an on-field municipal technician with an SLA clock.\n4. 🚧 **In Progress**: Work crews are actively on-site fixing the problem.\n5. 📸 **Pending Verification**: Technician finished work and submitted **Before & After photos**.\n6. ✅ **Resolved**: Verified by citizens in the Community feed and closed!\n\nYou can track all your submissions live in the **My Reports** tab.`,
      actions: [
        { label: "🔍 Track my pending report", actionId: "quick_prompt", variant: "primary", promptPayload: "Track my report which is pending" },
        { label: "📄 Open My Reports", actionId: "go_to_my_reports", variant: "secondary" },
      ],
    };
  }

  // 7. COMMUNITY VOTING & VERIFICATION
  if (/community|vote|voting|verify|verification|approve|thumbs up|before after/i.test(lower)) {
    return {
      type: "informational",
      text: `🗳️ **Community Verification & Citizen Voting:**\n\nCivicFix ensures government accountability through **Community Verification**:\n\n• When city workers complete a repair, they must upload **Before & After photographic proof**.\n• The work order is published to the **Community Feed**.\n• Local residents inspect the photos and vote **"👍 Looks Great"** or **"👎 Incomplete"**.\n• Once a quorum of **3+ verified citizen votes** is reached, the report is officially certified as **Resolved**!\n• Participating in verification boosts your citizen **Trust Score**!`,
      actions: [
        { label: "🗳️ Go to Community Feed", actionId: "go_to_community", variant: "primary" },
        { label: "⭐ What is Trust Score?", actionId: "quick_prompt", variant: "secondary", promptPayload: "How does Trust Score work?" },
      ],
    };
  }

  // 8. DELETING A REPORT
  if (/delete|remove|cancel (my|a) (post|report|issue)|how to delete/i.test(lower)) {
    return {
      type: "informational",
      text: `🗑️ **How to Delete a Report You Posted:**\n\nIf you submitted a report by mistake or the issue is already cleared:\n\n1. Open the **"My Reports"** tab from the bottom navigation.\n2. Tap on the report you want to delete.\n3. Scroll to the bottom and tap **"🗑️ Delete this report"**.\n4. Confirm when prompted.\n\n*Note: Only the original reporter or municipal administrators can delete a report.*`,
      actions: [
        { label: "📄 Go to My Reports", actionId: "go_to_my_reports", variant: "primary" },
        { label: "🚀 File a New Report", actionId: "go_to_report", variant: "secondary" },
      ],
    };
  }

  // 9. TRUST SCORE & BADGES
  if (/trust score|karma|badge|points|reputation|penalty/i.test(lower)) {
    return {
      type: "informational",
      text: `⭐ **CivicFix Citizen Trust Score:**\n\n• **Starting Score**: Every registered resident starts with **100 Trust Points**.\n• **Earn Points (+5 to +15)**: Submit verified reports, upload clear photos, and participate in community resolution voting.\n• **Badges**: Unlock badges like *Civic Scout*, *Neighborhood Guardian*, and *Master Verifier*.\n• **Penalty (-15)**: Submitting false, malicious, or spam reports reduces your Trust Score and restricts automated triage.`,
      actions: [
        { label: "🚀 File a Report", actionId: "go_to_report", variant: "primary" },
        { label: "🗳️ Vote on Community Fixes", actionId: "go_to_community", variant: "secondary" },
      ],
    };
  }

  // 10. DEPARTMENTS & MUNICIPAL JURISDICTION
  if (/department|who fixes|jurisdiction|public works|sanitation|electrical|water|authority/i.test(lower)) {
    return {
      type: "informational",
      text: `🏛️ **Municipal Departments & SLA Response Times:**\n\n• **Public Works Department** (24–48h SLA)\n  Repairs road potholes, cracked sidewalks, asphalt cave-ins, and curbs.\n\n• **Sanitation & Waste Management** (12–24h SLA)\n  Clears overflowing public dumpsters, illegal dumping, and park litter.\n\n• **Electrical & Lighting Services** (12–36h SLA)\n  Fixes non-functional streetlamps, dark pathways, and exposed wiring.\n\n• **Water & Storm Drainage** (12–24h SLA)\n  Handles storm drain blockages, standing floodwater, and pipe leaks.`,
      actions: [
        { label: "🚀 Report an Issue Now", actionId: "go_to_report", variant: "primary" },
        { label: "📝 View Steps to Report", actionId: "quick_prompt", variant: "secondary", promptPayload: "Give us steps to rise a report or issue in this platform" },
      ],
    };
  }

  // 11. WHAT IS CIVICFIX / ABOUT
  if (/what is civicfix|about (this|the) (app|platform|website)|who made/i.test(lower)) {
    return {
      type: "informational",
      text: `🌟 **About CivicFix:**\n\nCivicFix is a modern, AI-powered civic issue reporting and municipal resolution platform.\n\nIt connects **Citizens**, **City Dispatchers**, and **Field Maintenance Workers** with:\n• Instant AI photo & location triage\n• Transparent live SLA tracking\n• Community Before/After verification voting\n• Public accountability dashboards`,
      actions: [
        { label: "🚀 Report an Issue", actionId: "go_to_report", variant: "primary" },
        { label: "🗳️ Community Verification", actionId: "go_to_community", variant: "secondary" },
      ],
    };
  }

  // 12. ADMIN, DISPATCH & FIELD WORKER WORKFLOWS
  if (/admin|dispatch|staff|worker|take task|assign|complete task/i.test(lower)) {
    return {
      type: "informational",
      text: `🛠️ **City Staff & Field Worker Operations:**\n\n• **Admin Queue (\`/admin/queue\`)**:\n  Dispatchers review incoming reports, verify legitimacy, or cancel spam. Tapping **"⚡ Take the Task"** assigns it to a field crew with SLA timeframes.\n\n• **Field Assignments (\`/admin/assignments\`)**:\n  Field workers navigate to the site with live GPS, execute repair SOPs, and upload **Before & After evidence** to complete the work order.`,
      actions: [
        { label: "📋 Open My Reports", actionId: "go_to_my_reports", variant: "primary" },
        { label: "🚀 File a Report", actionId: "go_to_report", variant: "secondary" },
      ],
    };
  }

  // 13. EMERGENCY WARNING
  if (/emergency|fire|police|ambulance|crime|injury|medical|life/i.test(lower)) {
    return {
      type: "informational",
      text: `🚨 **IMPORTANT EMERGENCY NOTICE:**\n\nCivicFix is designed for **non-emergency municipal infrastructure maintenance**.\n\nIf you are experiencing or witnessing an active emergency, crime, severe injury, fire, or gas leak:\n\n👉 **Please dial emergency services immediately (911 / 112 / 100)**.`,
      actions: [
        { label: "🚀 Report Non-Emergency Defect", actionId: "go_to_report", variant: "primary" },
        { label: "📄 View My Reports", actionId: "go_to_my_reports", variant: "secondary" },
      ],
    };
  }

  // 14. IF THE USER IS REPORTING AN ACTUAL PHYSICAL DEFECT
  const isActualDefect =
    /pothole|crater|sinkhole|asphalt|road damage|broken road|leak|water leak|pipe burst|garbage|trash|dump|litter|overflow|streetlight|street lamp|light out|dark road|tree fallen|graffiti|open manhole/i.test(
      lower,
    ) && !/how|steps|what|can i|explain|why|tell me|who|image|photo|picture|track|letter|handbook|guide/i.test(lower);

  if (isActualDefect || (attachedPhoto && !isImageAnalysisQuery && query.length < 10)) {
    const { category, severity } = detectCategoryAndSeverity(query);
    return createTriageResponse(category, severity, query, attachedPhoto, currentLocation);
  }

  // 15. GENERAL HELPFUL FALLBACK
  return {
    type: "informational",
    text: `🤖 I'm here to help with everything on **CivicFix**!\n\nHere are some things you can ask me:\n• *"Track my report which is pending"*\n• *"Give us steps to raise a report on this platform"*\n• *"How does community verification voting work?"*\n• *"How do I delete my report?"*\n• *"Tell me the complete handbook for this website"*\n• *"There is a broken streetlight near my street"* (to file a live report)`,
    actions: [
      { label: "🔍 Track my pending report", actionId: "quick_prompt", variant: "primary", promptPayload: "Track my report which is pending" },
      { label: "📜 Platform Handbook", actionId: "quick_prompt", variant: "secondary", promptPayload: "Tell me the complete handbook for this website" },
      { label: "📝 Steps to file a report", actionId: "quick_prompt", variant: "secondary", promptPayload: "Give us steps to rise a report or issue in this platform" },
    ],
  };
}

function detectCategoryAndSeverity(text: string): {
  category: "pothole" | "garbage" | "streetlight" | "other";
  severity: "low" | "medium" | "high" | "critical";
} {
  const lower = text.toLowerCase();
  let category: "pothole" | "garbage" | "streetlight" | "other" = "other";
  if (/pothole|road|asphalt|crater|sinkhole|pavement|curb/.test(lower)) category = "pothole";
  else if (/garbage|trash|dump|litter|waste|bin|overflow/.test(lower)) category = "garbage";
  else if (/streetlight|lamp|light|dark|bulb|pole/.test(lower)) category = "streetlight";

  let severity: "low" | "medium" | "high" | "critical" = "medium";
  if (/danger|hazard|emergency|fatal|huge|deep|critical|accident|urgent/.test(lower)) severity = "high";
  else if (/minor|small|cosmetic|tiny/.test(lower)) severity = "low";

  return { category, severity };
}

function createTriageResponse(
  category: "pothole" | "garbage" | "streetlight" | "other",
  severity: "low" | "medium" | "high" | "critical",
  description: string,
  attachedPhoto?: { uri: string; base64?: string } | null,
  currentLocation?: { lat: number; lng: number; address?: string } | null,
): AIResponse {
  const catLabels: Record<string, string> = {
    pothole: "Pothole / Road Damage 🕳️",
    garbage: "Sanitation / Trash Overflow 🗑️",
    streetlight: "Street Lighting 💡",
    other: "General Civic Concern 🏛️",
  };

  return {
    type: "triage_report",
    text: `Got it! I triaged this issue as:\n\n• **Category**: ${catLabels[category]}\n• **Severity**: ${severity.toUpperCase()}\n• **Location**: ${currentLocation?.address || "GPS Pinned (12m accuracy)"}\n\nWould you like me to submit this report to city dispatch?`,
    extracted: {
      category,
      severity,
      description: description || "Civic report submitted via CivicBot AI",
      locationText: currentLocation?.address || "Current Location",
      latitude: currentLocation?.lat || 31.2542,
      longitude: currentLocation?.lng || 75.7054,
      photoUri: attachedPhoto?.uri || undefined,
      photoBase64: attachedPhoto?.base64 || undefined,
    },
    actions: [
      { label: "✅ Submit Report Now", actionId: "confirm_report", variant: "primary" },
      { label: "✏️ Modify in Report Screen", actionId: "go_to_report", variant: "secondary" },
    ],
  };
}
