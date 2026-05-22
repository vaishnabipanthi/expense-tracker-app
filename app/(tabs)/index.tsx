import { useState } from 'react';
import { Image } from 'expo-image';
import { PieChart } from 'react-native-chart-kit';
import { Platform, StyleSheet, Button, View, Alert, Text, ActivityIndicator, FlatList } from 'react-native';
import { HelloWave } from '@/components/hello-wave';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import * as DocumentPicker from 'expo-document-picker';

interface Transaction {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
}

export default function HomeScreen() {
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const totalExpense = transactions.reduce(
  (sum, item) => sum + item.amount,
  0
);
  const foodTotal = transactions
  .filter(item => item.category === 'Food')
  .reduce((sum, item) => sum + item.amount, 0);

const travelTotal = transactions
  .filter(item => item.category === 'Travel')
  .reduce((sum, item) => sum + item.amount, 0);

const shoppingTotal = transactions
  .filter(item => item.category === 'Shopping')
  .reduce((sum, item) => sum + item.amount, 0);
  const chartData = [
  {
    name: 'Food',
    amount: foodTotal,
    color: '#ff6384',
    legendFontColor: '#333',
    legendFontSize: 14,
  },
  {
    name: 'Travel',
    amount: travelTotal,
    color: '#36a2eb',
    legendFontColor: '#333',
    legendFontSize: 14,
  },
  {
    name: 'Shopping',
    amount: shoppingTotal,
    color: '#ffce56',
    legendFontColor: '#333',
    legendFontSize: 14,
  },
];
const budgetLimit = 5000;

const isBudgetExceeded = totalExpense > budgetLimit;

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (!result.canceled) {
        const fileDetails = result.assets[0];
        setSelectedFile(fileDetails);
        Alert.alert("Success", `File Selected: ${fileDetails.name}`);
      }
    } catch (error) {
      Alert.alert("Error", "failed to pick document.");
    }
  };
  const uploadFileToServer = async () => {
    if (!selectedFile) {
      Alert.alert("Error", "first select a PDF file!");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      
      if (Platform.OS === 'web') {
        const responseFile = await fetch(selectedFile.uri);
        const blob = await responseFile.blob();
        formData.append('statement', blob, selectedFile.name);
      } else {
        formData.append('statement', {
          uri: selectedFile.uri,
          name: selectedFile.name,
          type: selectedFile.mimeType || 'application/pdf',
        } as any);
      }

      const response = await fetch('http://192.168.1.3:5000/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      setLoading(false);

      if (result.success) {
        setTransactions(result.transactions); 
        Alert.alert("Success", `Backend ne total ${result.transactions.length} transactions parse kiye!`);
      } else {
        Alert.alert("Error", result.error || "Server ne respond nahi kiya.");
      }

    } catch (error: any) {
      setLoading(false);
      console.log("Upload Error:", error);
      Alert.alert("Network Error", "Backend server se connection nahi ho pa raha h.");
    }
  };
  const renderTransactionCard = ({ item }: { item: Transaction }) => (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <Text style={styles.cardDescription}>{item.description}</Text>
        <Text style={styles.cardMeta}>{item.date} • <Text style={styles.categoryText}>{item.category}</Text></Text>
      </View>
      <Text style={styles.cardAmount}>₹{item.amount}</Text>
    </View>
  );

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={<Image source={require('@/assets/images/partial-react-logo.png')} style={styles.reactLogo} />}>
      
      <ThemedView style={styles.titleContainer}>
        
        <ThemedText type="title">Expense Tracker</ThemedText>
        <HelloWave />
      </ThemedView>

      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Upload Statement</ThemedText>
        {selectedFile ? (
          <View style={styles.fileBox}>
            <Text style={styles.fileText}>Name: {selectedFile.name}</Text>
            <Text style={styles.fileText}>Size: {(selectedFile.size / 1024).toFixed(2)} KB</Text>
          </View>
        ) : (
          <ThemedText>Please select your bank statement PDF.</ThemedText>
        )}
        
        <Button title="Choose PDF File" onPress={pickDocument} color="#6200ee" />
        
        {selectedFile && !loading && (
          <View style={{ marginTop: 10 }}>
            <Button title="Upload & Parse Statement" onPress={uploadFileToServer} color="#2e7d32" />
          </View>
        )}

        {loading && (
          <ActivityIndicator size="large" color="#2e7d32" style={{ marginTop: 15 }} />
        )}
      </ThemedView>

      {}
      <ThemedView style={styles.listContainer}>
        <View style={{ marginTop: 20, alignItems: 'center' }}>

  <Text
    style={{
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 10,
    }}
  >
    Monthly Spending
  </Text>

  <PieChart
    data={chartData}
    width={350}
    height={220}
    chartConfig={{
      color: () => '#000',
    }}
    accessor="amount"
    backgroundColor="transparent"
    paddingLeft="15"
    absolute
  />

</View>
{isBudgetExceeded && (
  <View
    style={{
      backgroundColor: '#ffdddd',
      padding: 12,
      borderRadius: 8,
      marginTop: 15,
      marginBottom: 15,
    }}
  >
    <Text
      style={{
        color: '#d32f2f',
        fontWeight: 'bold',
        textAlign: 'center',
      }}
    >
      Budget Alert! Total spending exceeded ₹5000
    </Text>
  </View>
)}
        <ThemedText type="subtitle" style={{ marginBottom: 10 }}>Detected Expenses</ThemedText>
        
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderTransactionCard}
          scrollEnabled={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No Transactions Found.</Text>
          }
        />
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepContainer: { gap: 8, marginBottom: 15 },
  listContainer: { gap: 8, marginTop: 10 },
  reactLogo: { height: 178, width: 290, bottom: 0, left: 0, position: 'absolute' },
  fileBox: { backgroundColor: '#eaeaea', padding: 12, borderRadius: 6, marginVertical: 5 },
  fileText: { fontSize: 14, color: '#333' },
  
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, elevation: 2 },
  cardLeft: { flex: 1 },
  cardDescription: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  cardMeta: { fontSize: 12, color: '#666', marginTop: 4 },
  categoryText: { color: '#6200ee', fontWeight: 'bold' },
  cardAmount: { fontSize: 16, fontWeight: 'bold', color: '#d32f2f', marginLeft: 10 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 20, fontSize: 14 }
});