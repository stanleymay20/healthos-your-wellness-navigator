export const trendData7d = [
  { day: "Mon", score: 74 },
  { day: "Tue", score: 76 },
  { day: "Wed", score: 72 },
  { day: "Thu", score: 78 },
  { day: "Fri", score: 80 },
  { day: "Sat", score: 79 },
  { day: "Sun", score: 82 },
];

export const trendData30d = Array.from({ length: 30 }, (_, i) => ({
  day: `D${i + 1}`,
  score: 65 + Math.round(Math.sin(i / 4) * 6 + i * 0.4 + Math.random() * 4),
}));

export const trendData90d = Array.from({ length: 90 }, (_, i) => ({
  day: `D${i + 1}`,
  score: 60 + Math.round(Math.sin(i / 8) * 8 + i * 0.15 + Math.random() * 3),
}));

export const sparklineUp = Array.from({ length: 14 }, (_, i) => ({
  i,
  v: 40 + i * 2 + Math.random() * 6,
}));

export const sparklineFlat = Array.from({ length: 14 }, (_, i) => ({
  i,
  v: 50 + Math.sin(i) * 8 + Math.random() * 4,
}));

export const sparklineDown = Array.from({ length: 14 }, (_, i) => ({
  i,
  v: 70 - i * 1.5 + Math.random() * 5,
}));

export const breakdownData = [
  { dim: "Sleep", score: 8 },
  { dim: "Activity", score: 7 },
  { dim: "Stress", score: 7 },
  { dim: "Recovery", score: 8 },
  { dim: "Nutrition", score: 6 },
];

export const recentLogs = [
  { id: 1, type: "Sleep", value: "7h 23m", note: "Good", time: "7:30 AM", icon: "moon" },
  { id: 2, type: "Meditation", value: "15 min", note: "", time: "6:45 AM", icon: "brain" },
  { id: 3, type: "Running", value: "4.2 km", note: "", time: "6:20 AM", icon: "activity" },
  { id: 4, type: "Meals", value: "2,150 kcal", note: "", time: "12:30 PM", icon: "utensils" },
  { id: 5, type: "Water", value: "2.1 L", note: "", time: "11:15 AM", icon: "droplet" },
];

export const recommendations = [
  {
    id: "r1",
    title: "Take a 20-min walk after lunch",
    description:
      "Your energy usually dips in the afternoon. A short walk can boost your energy and focus.",
    category: "Activity",
    priority: "high" as const,
    status: "pending" as const,
  },
  {
    id: "r2",
    title: "Sleep 45 minutes earlier tonight",
    description: "Your sleep window has drifted later this week. Resetting tonight will help recovery.",
    category: "Sleep",
    priority: "medium" as const,
    status: "pending" as const,
  },
  {
    id: "r3",
    title: "Add 500ml of water before 3 PM",
    description: "You're trending 15% below your hydration target.",
    category: "Nutrition",
    priority: "low" as const,
    status: "pending" as const,
  },
];

export const insights = [
  {
    id: "i1",
    title: "Your sleep consistency improved 18% this week",
    description: "Bedtime variance dropped from 52 min to 31 min. Keep protecting your wind-down window.",
    type: "positive" as const,
  },
  {
    id: "i2",
    title: "Afternoon stress is trending upward",
    description: "Stress peaks between 2–4 PM on weekdays. Try a 5-min breathing break.",
    type: "warning" as const,
  },
  {
    id: "i3",
    title: "Recovery is keeping pace with activity",
    description: "Your HRV held steady despite a 22% increase in training load.",
    type: "positive" as const,
  },
];

export const devices = [
  { id: "oura", name: "Oura Ring", status: "available", description: "Sleep, HRV, readiness, body temp." },
  { id: "whoop", name: "WHOOP", status: "available", description: "Strain, recovery, sleep coaching." },
  { id: "fitbit", name: "Fitbit", status: "available", description: "Steps, heart rate, sleep stages." },
  { id: "garmin", name: "Garmin", status: "available", description: "Training load, VO2 max, GPS workouts." },
  { id: "apple", name: "Apple Health", status: "available", description: "Unified iOS health data." },
  { id: "withings", name: "Withings", status: "coming-soon", description: "Body composition, BP, ECG." },
  { id: "dexcom", name: "Dexcom", status: "coming-soon", description: "Continuous glucose monitoring." },
] as const;
