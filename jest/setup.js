// Icon fonts load asynchronously through expo-font, which has no assets under Jest.
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
