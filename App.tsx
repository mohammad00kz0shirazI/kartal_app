import React, { useEffect, useState, useRef } from 'react';
import {
  SafeAreaView,
  Text,
  StyleSheet,
  StatusBar,
  View,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';

import * as Notifications from 'expo-notifications';
import * as Permissions from 'expo-permissions';

import { LineChart } from 'react-native-chart-kit';

type PriceData = {
  goldPrice: number | null;
  dollarPrice: number | null;
  bitcoinPrice: number | null;
  ethereumPrice: number | null;
  tetherPrice: number | null;
};

type NewsItem = {
  id: number;
  title: string;
  source: string;
  date: string;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const screenWidth = Dimensions.get('window').width - 40; // padding

export default function App() {
  const [prices, setPrices] = useState<PriceData>({
    goldPrice: null,
    dollarPrice: null,
    bitcoinPrice: null,
    ethereumPrice: null,
    tetherPrice: null,
  });
  const [loading, setLoading] = useState(true);
  const [news, setNews] = useState<NewsItem[]>([]);

  // برای ذخیره تاریخچه قیمت‌ها برای نمودار (آخرین 5 مقدار)
  const [history, setHistory] = useState<{
    gold: number[];
    bitcoin: number[];
  }>({
    gold: [],
    bitcoin: [],
  });

  const oldPrices = useRef<PriceData>({
    goldPrice: null,
    dollarPrice: null,
    bitcoinPrice: null,
    ethereumPrice: null,
    tetherPrice: null,
  });

  // ثبت توکن نوتیفیکیشن (فعلا استفاده نمیشه، برای بعد)
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => setExpoPushToken(token));

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification Received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification Response:', response);
    });

    fetchPrices();
    fetchNews();
    setLoading(false);

    // رفرش خودکار هر 30 ثانیه
    const interval = setInterval(() => {
      fetchPrices();
    }, 30000);

    return () => {
      clearInterval(interval);
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  async function registerForPushNotificationsAsync() {
    let token;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const { status: existingStatus } = await Permissions.getAsync(Permissions.NOTIFICATIONS);
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Permissions.askAsync(Permissions.NOTIFICATIONS);
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      Alert.alert('اجازه نوتیفیکیشن داده نشده', 'برای دریافت هشدارها باید اجازه دهید.');
      return;
    }

    token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('Expo Push Token:', token);

    return token;
  }

  // ارسال نوتیفیکیشن محلی فوری
  async function sendPriceAlert(title: string, body: string) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null,
    });
  }

  // مقایسه تغییر قیمت و ارسال نوتیفیکیشن در صورت تغییر بیشتر از 5%
  function checkPriceChangeAndNotify(newPrices: PriceData) {
    const keys: (keyof PriceData)[] = ['goldPrice', 'bitcoinPrice'];
    keys.forEach(key => {
      const oldPrice = oldPrices.current[key];
      const newPrice = newPrices[key];
      if (oldPrice && newPrice) {
        const changePercent = Math.abs((newPrice - oldPrice) / oldPrice) * 100;
        if (changePercent >= 5) {
          const itemName = key === 'goldPrice' ? 'طلا 18 عیار' : 'بیت کوین';
          sendPriceAlert(
            `تغییر قیمت ${itemName}`,
            `قیمت ${itemName} بیش از ${changePercent.toFixed(1)}٪ تغییر کرد.`
          );
        }
      }
    });
    oldPrices.current = newPrices;
  }

  async function fetchPrices() {
    try {
      const goldPrice = 1_200_000; // فرضی، می‌تونی API بزنی اینجا
      const dollarPrice = 42000; // فرضی

      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd'
      );
      const data = await res.json();

      const newPrices: PriceData = {
        goldPrice,
        dollarPrice,
        bitcoinPrice: data.bitcoin.usd,
        ethereumPrice: data.ethereum.usd,
        tetherPrice: data.tether.usd,
      };

      checkPriceChangeAndNotify(newPrices);

      setPrices(newPrices);

      // ذخیره تاریخچه برای نمودار (آخرین 5 مقدار)
      setHistory(prev => {
        const newGoldArr = [...prev.gold, goldPrice].slice(-5);
        const newBtcArr = [...prev.bitcoin, newPrices.bitcoinPrice || 0].slice(-5);
        return { gold: newGoldArr, bitcoin: newBtcArr };
      });
    } catch (error) {
      console.error('Error fetching prices:', error);
    }
  }

  function fetchNews() {
    setNews([
      { id: 1, title: 'بیت کوین رکورد جدیدی ثبت کرد', source: 'CoinDesk', date: '2025-09-15' },
      { id: 2, title: 'طلا به دلیل نوسانات بازار افزایش یافت', source: 'GoldNews', date: '2025-09-14' },
      { id: 3, title: 'دلار آمریکا در مقابل یورو تقویت شد', source: 'ForexToday', date: '2025-09-13' },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#fff" />
      </SafeAreaView>
    );
  }

  const PriceCard = ({ title, price, unit }: { title: string; price: number | null; unit: string }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardPrice}>
        {price !== null ? price.toLocaleString() : '--'} {unit}
      </Text>
    </View>
  );

  const NewsCard = ({ item }: { item: NewsItem }) => (
    <View style={styles.newsCard}>
      <Text style={styles.newsTitle}>{item.title}</Text>
      <View style={styles.newsFooter}>
        <Text style={styles.newsSource}>{item.source}</Text>
        <Text style={styles.newsDate}>{item.date}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>قیمت لحظه‌ای</Text>
        <PriceCard title="طلا 18 عیار" price={prices.goldPrice} unit="تومان" />
        <PriceCard title="دلار" price={prices.dollarPrice} unit="تومان" />
        <PriceCard title="بیت کوین" price={prices.bitcoinPrice} unit="دلار" />
        <PriceCard title="اتریوم" price={prices.ethereumPrice} unit="دلار" />
        <PriceCard title="تتر" price={prices.tetherPrice} unit="دلار" />

        {/* نمودار قیمت بیت‌کوین و طلا */}
        <Text style={[styles.title, { marginTop: 30 }]}>نمودار قیمت</Text>
        <LineChart
          data={{
            labels: ['-4', '-3', '-2', '-1', 'اکنون'],
            datasets: [
              {
                data: history.gold,
                color: (opacity = 1) => `rgba(255, 215, 0, ${opacity})`, // طلایی
                strokeWidth: 2,
                label: 'طلا 18 عیار',
              },
              {
                data: history.bitcoin,
                color: (opacity = 1) => `rgba(255, 69, 0, ${opacity})`, // قرمز نارنجی
                strokeWidth: 2,
                label: 'بیت کوین',
              },
            ],
            legend: ['طلا 18 عیار', 'بیت کوین'],
          }}
          width={screenWidth}
          height={220}
          chartConfig={{
            backgroundColor: '#121212',
            backgroundGradientFrom: '#121212',
            backgroundGradientTo: '#1e1e1e',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(200, 200, 200, ${opacity})`,
            style: {
              borderRadius: 10,
            },
            propsForDots: {
              r: '4',
              strokeWidth: '2',
              stroke: '#fff',
            },
          }}
          bezier
          style={{
            marginVertical: 10,
            borderRadius: 10,
          }}
        />

        <Text style={[styles.title, { marginTop: 30 }]}>اخبار بازار</Text>
        {news.map(item => (
          <NewsCard key={item.id} item={item} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollContainer: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#1e1e1e',
    width: '100%',
    padding: 20,
    borderRadius: 10,
    marginBottom: 15,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 10,
  },
  cardPrice: {
    color: '#0f0',
    fontSize: 22,
    fontWeight: 'bold',
  },
  newsCard: {
    backgroundColor: '#222222',
    width: '100%',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  newsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  newsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  newsSource: {
    color: '#aaa',
    fontSize: 12,
  },
  newsDate: {
    color: '#aaa',
    fontSize: 12,
  },
});
