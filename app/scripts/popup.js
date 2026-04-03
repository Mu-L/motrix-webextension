'use strict';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { Grid, Paper, IconButton, LinearProgress } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import FolderIcon from '@mui/icons-material/Folder';
import HistoryIcon from '@mui/icons-material/History';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import createThemed from './createThemed';
import PropTypes from 'prop-types';
import * as browser from 'webextension-polyfill';

function OptProgress({ status, downloaded, size }) {
  if (status !== 'downloading') return null;
  if (downloaded != null && size != null && size > 0) {
    return (
      <LinearProgress
        style={{ margin: '4px' }}
        variant="determinate"
        value={Math.min((downloaded * 100) / size, 100)}
      />
    );
  }
  return <LinearProgress style={{ margin: '4px' }} />;
}

OptProgress.propTypes = {
  status: PropTypes.string,
  downloaded: PropTypes.number,
  size: PropTypes.number,
};

function FolderButton({ element }) {
  if (element.status !== 'completed') return null;

  const onClick =
    element.downloader === 'browser'
      ? () => browser.downloads.show(element.gid)
      : () => browser.tabs.create({ url: 'motrix://' });

  return (
    <IconButton variant="outlined" onClick={onClick}>
      <FolderIcon />
    </IconButton>
  );
}

FolderButton.propTypes = {
  element: PropTypes.object,
};

function PopupView() {
  const [downloadHistory, setDownloadHistory] = useState([]);
  const [extensionStatus, setExtensionStatus] = useState(false);
  const [showOnlyAriaDownloads, setShowOnlyAriaDownloads] = useState(false);

  useEffect(() => {
    browser.storage.local.get(['history']).then(({ history = [] }) => {
      setDownloadHistory(history);
    });

    const listener = (changes) => {
      if (changes.history) setDownloadHistory(changes.history.newValue ?? []);
    };
    browser.storage.local.onChanged.addListener(listener);
    return () => browser.storage.local.onChanged.removeListener(listener);
  }, []);

  useEffect(() => {
    browser.storage.sync
      .get(['extensionStatus', 'showOnlyAria'])
      .then(({ extensionStatus: status, showOnlyAria }) => {
        setExtensionStatus(status ?? false);
        setShowOnlyAriaDownloads(showOnlyAria ?? false);
      });

    const listener = (changes) => {
      if (changes.extensionStatus) setExtensionStatus(changes.extensionStatus.newValue);
      if (changes.showOnlyAria) setShowOnlyAriaDownloads(changes.showOnlyAria.newValue);
    };
    browser.storage.sync.onChanged.addListener(listener);
    return () => browser.storage.sync.onChanged.removeListener(listener);
  }, []);

  const onExtensionStatusChange = (status) => {
    browser.storage.sync.set({ extensionStatus: status });
    if (!status) browser.downloads.setShelfEnabled?.(true);
    setExtensionStatus(status);
  };

  const parseName = (name) => {
    if (name == null) return 'unknown';
    if (name.length < 52) return name;
    return `${name.slice(0, 52)}...`;
  };

  return (
    <Grid container justifyContent="center" spacing={2}>
      <Grid item xs={2}>
        <IconButton
          variant="outlined"
          onClick={() => onExtensionStatusChange(!extensionStatus)}
        >
          <PowerSettingsNewIcon color={extensionStatus ? 'success' : 'error'} />
        </IconButton>
      </Grid>
      <Grid item xs={2}>
        <IconButton
          variant="outlined"
          onClick={() => browser.tabs.create({ url: browser.runtime.getURL('pages/config.html') })}
        >
          <SettingsIcon />
        </IconButton>
      </Grid>
      <Grid item xs={1} />
      <Grid item xs={2}>
        <IconButton
          variant="outlined"
          onClick={() => browser.tabs.create({ url: browser.runtime.getURL('pages/history.html') })}
        >
          <HistoryIcon />
        </IconButton>
      </Grid>
      <Grid item xs={2}>
        <IconButton
          variant="outlined"
          onClick={() => {
            setDownloadHistory([]);
            browser.storage.local.set({ history: [], downloads: {} });
          }}
        >
          <ClearAllIcon />
        </IconButton>
      </Grid>
      <Grid item xs={2}>
        <IconButton
          variant="outlined"
          onClick={() => browser.downloads.showDefaultFolder()}
        >
          <FolderIcon />
        </IconButton>
      </Grid>
      <Grid item xs={11}>
        {downloadHistory
          .filter((el) => !showOnlyAriaDownloads || el.downloader === 'aria')
          .slice(0, 4)
          .map((el) => (
            <Paper key={el.gid} style={{ display: 'flex', marginBottom: '8px' }}>
              <div
                style={{
                  padding: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <img src={el.icon ?? ''} alt="icon" />
              </div>
              <div
                style={{
                  padding: '8px',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <div className="text">{parseName(el.name)}</div>
                <OptProgress
                  status={el.status}
                  downloaded={el.downloaded}
                  size={el.size}
                />
              </div>
              <div
                style={{
                  padding: '4px',
                  minWidth: '50px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                <FolderButton element={el} />
              </div>
            </Paper>
          ))}
      </Grid>
    </Grid>
  );
}

const domContainer = document.querySelector('#react-root');
ReactDOM.render(React.createElement(createThemed(PopupView)), domContainer);
