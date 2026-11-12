import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Spies</Text>
      <Text style={styles.subtitle}>A two-player card game</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 40, fontWeight: '700' },
  subtitle: { marginTop: 8, fontSize: 16, color: '#555' },
});
