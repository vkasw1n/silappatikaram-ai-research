export type SampleQuery = { id: number; text: string; language: "en" | "ta"; category: string };

// Render these immediately while the full filtered list loads from the API.
export const INITIAL_SAMPLE_QUERIES: SampleQuery[] = [
  { id: 1, text: "Which graph relationships are linked to Kovalan and the anklet?", language: "en", category: "graph" },
  { id: 2, text: "Which passage records the evidence about Kovalan's execution?", language: "en", category: "evidence" },
  { id: 3, text: "What entities are connected with Kannaki in the knowledge graph?", language: "en", category: "graph" },
  { id: 4, text: "What does the corpus establish about Kannaki and the anklet?", language: "en", category: "corpus" },
  { id: 5, text: "கண்ணகி சிலம்பு தொடர்பான உரைச்சான்று எது?", language: "ta", category: "evidence" },
  { id: 6, text: "கோவலனுடன் தொடர்புடைய பாதை மற்றும் உறவுகள் யாவை?", language: "ta", category: "graph" },
  { id: 7, text: "மதுரையில் கோவலனின் மரணம் பற்றி உரை என்ன கூறுகிறது?", language: "ta", category: "corpus" },
  { id: 8, text: "பதிவிலுள்ள ஆதாரங்களை மட்டும் கொண்டு கண்ணகியின் வழக்கை விளக்குக.", language: "ta", category: "verification" },
];
