import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import './WaypointEditor.css';
import { useNotification } from './services/notification.service';
import { Waypoint } from './types/waypoint.types';
import { 
  addEditorWaypoint, 
  removeEditorWaypoint, 
  applyEditorWaypoints,
  setWaypointsLoading, 
  setWaypointsError,
  clearEditorWaypoints,
  setEditorWaypoints,
  clearPendingWaypointFromMap
} from '../../store/waypointsSlice';
import type { RootState } from '../../store';
import { parseWaypointTxt } from './utils/waypointParser';

interface WaypointEditorProps { 
  onClose: () => void; 
  onSaveWaypoints?: (waypoints: Waypoint[]) => Promise<void>;
}

const WaypointEditor: React.FC<WaypointEditorProps> = ({ onClose, onSaveWaypoints }) => {
  const dispatch = useDispatch();
  const { showSuccess, showError, showWarning } = useNotification();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 订阅 Redux 状态
  const isOpen = useSelector((state: RootState) => state.editor.isOpen);
  const editorWaypoints = useSelector((state: RootState) => state.waypoints.editorWaypoints);
  const isLoading = useSelector((state: RootState) => state.waypoints.isLoading);
  const error = useSelector((state: RootState) => state.waypoints.error);
  
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');

  const pendingWaypointFromMap = useSelector(
    (state: RootState) => state.waypoints.pendingWaypointFromMap
  );

  useEffect(() => {
    if (pendingWaypointFromMap) {
      setLat(pendingWaypointFromMap.latitude.toFixed(7));
      setLon(pendingWaypointFromMap.longitude.toFixed(7));
      dispatch(clearPendingWaypointFromMap());
    }
  }, [pendingWaypointFromMap, dispatch]);

  if (!isOpen) return null;

  const handleAddWaypoint = () => {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      showError('Please enter valid coordinates');
      return;
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      showError('Coordinates out of range');
      return;
    }

    const newWp: Waypoint = {
      id: `wp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      latitude,
      longitude,
    };
    dispatch(addEditorWaypoint(newWp));
    setLat('');
    setLon('');
  };

  const handleSaveToBackend = async () => {
    if (editorWaypoints.length === 0) {
      showWarning('No waypoints to save');
      return;
    }
    
    dispatch(setWaypointsLoading(true));
    try {
      if (onSaveWaypoints) {
        await onSaveWaypoints(editorWaypoints);
      } else {
        const payload = {
          waypoints: editorWaypoints,
          mission_name: "yildizusv_mission"
        };
        const response = await fetch('http://localhost:8000/api/save_waypoints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }
      showSuccess('Waypoints saved successfully');
    } catch (err: any) {
      dispatch(setWaypointsError(err.message || 'Failed to save'));
      showError(err.message || 'Failed to save waypoints');
    } finally {
      dispatch(setWaypointsLoading(false));
    }
  };

  const handleApply = () => {
    if (editorWaypoints.length === 0) {
      showWarning('No waypoints to apply');
      return;
    }
    dispatch(applyEditorWaypoints());
    showSuccess('Waypoints applied to operational map');
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        const result = parseWaypointTxt(text);
        if (result.waypoints.length === 0) {
          showWarning('No valid waypoints found in file');
          return;
        }
        dispatch(setEditorWaypoints(result.waypoints));
        showSuccess(`Imported ${result.waypoints.length} waypoints successfully`);
      } catch (err: any) {
        showError(`Import error: ${err.message}`);
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  return (
    <div className="waypoint-editor-container">
      <div className="waypoint-editor-header">
        <h2>🗺️ Waypoint Editor</h2>
        <button onClick={onClose} className="waypoint-editor-close-button">×</button>
      </div>

      <div className="waypoint-editor-list-container">
        {editorWaypoints.length === 0 ? (
          <div className="waypoint-editor-empty">No coordinates listed. Use Shift+Click on base map to collect data points.</div>
        ) : (
          <table className="waypoint-editor-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>ID</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {editorWaypoints.map((wp, index) => (
                <tr key={index}>
                  <td>WP{index + 1}</td>
                  <td>{wp.latitude.toFixed(6)}</td>
                  <td>{wp.longitude.toFixed(6)}</td>
                  <td>
                    <button
                      onClick={() => dispatch(removeEditorWaypoint(wp.id))}
                      className="waypoint-editor-remove-button"
                      title="Remove Point"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="waypoint-editor-toolbar">
        <button 
          onClick={() => dispatch(clearEditorWaypoints())} 
          disabled={editorWaypoints.length === 0}
          className="waypoint-editor-file-button"
          style={{ background: '#7f8c8d' }}
        >
          Clear All
        </button>
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="waypoint-editor-file-button"
        >
          Import TXT
        </button>
        <input 
          type="file" 
          accept=".txt" 
          ref={fileInputRef} 
          onChange={handleFileImport}
          style={{ display: 'none' }}
          className="waypoint-editor-file-input"
        />
      </div>

      <p className="waypoint-editor-map-hint">
        💡 <strong>Map pick:</strong> Hold <strong>Shift</strong> + <strong>left-click</strong> on the map to autofill coords below.
      </p>
      
      <div className="waypoint-editor-form-container">
        <input 
          type="number" 
          placeholder="Latitude" 
          value={lat} 
          onChange={e => setLat(e.target.value)} 
          className="waypoint-editor-input"
        />
        <input 
          type="number" 
          placeholder="Longitude" 
          value={lon} 
          onChange={e => setLon(e.target.value)} 
          className="waypoint-editor-input"
        />
        <button onClick={handleAddWaypoint} className="waypoint-editor-add-button">Add</button>
      </div>
      
      <div className="waypoint-editor-action-row">
        <button 
          onClick={handleSaveToBackend} 
          disabled={isLoading}
          className="waypoint-editor-action-btn waypoint-editor-action-btn--save"
        >
          {isLoading ? 'Saving...' : '💾 Save Draft'}
        </button>
        <button 
          onClick={handleApply} 
          className="waypoint-editor-action-btn waypoint-editor-action-btn--apply"
        >
          🚀 Apply to Map
        </button>
      </div>

      {error && <div className="waypoint-editor-error">⚠️ {error}</div>}
    </div>
  );
};

export default WaypointEditor;
