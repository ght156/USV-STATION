import CesiumMap from './app/pages/cesium_map/CesiumMap';
import FlightIndicator from './app/pages/cesium_map/components/flight-indicator/flight_indicator';
import { NotificationProvider } from './app/pages/cesium_map/services/notification.service';
import './App.css';

function App() {
  return (
    <NotificationProvider>
      <div className="stack-container">
        <div className="widget1">
          <CesiumMap />
        </div>
        <div className="widget2">
          <FlightIndicator />
        </div>
      </div>
    </NotificationProvider>
  );
}

export default App;
