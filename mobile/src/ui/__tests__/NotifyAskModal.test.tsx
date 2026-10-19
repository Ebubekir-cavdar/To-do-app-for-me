/// <reference types="jest" />
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { NotifyAskModal } from '../NotifyAskModal';

// The animated EventModal shell is out of scope here: render its content only while visible.
jest.mock('../EventModal', () => {
  const { createElement: h } = require('react');
  const { Text, View } = require('react-native');
  const Box = ({ children }: { children: unknown }) => h(View, null, children);
  return {
    EventModal: ({ visible, title, children }: { visible: boolean; title: string; children: unknown }) =>
      visible ? h(View, null, h(Text, null, title), children) : null,
    EvBody: Box,
    EvOpts: Box,
    evText: {},
  };
});

const mockApi = {
  permission: 'undetermined' as const,
  settings: { daily: true, reminders: true },
  setSettings: jest.fn(),
  requestPermission: jest.fn(() => Promise.resolve(true)),
  shouldAskPermission: true,
  markAsked: jest.fn(),
  sendTestReminder: jest.fn(() => Promise.resolve()),
};
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-audio', () => ({ useAudioPlayer: () => ({}), setAudioModeAsync: () => Promise.resolve() }));
jest.mock('../../notifications', () => ({ useNotifications: () => mockApi }));
const mockLog = jest.fn();
jest.mock('../MessageLog', () => ({ useLog: () => mockLog }));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockApi.shouldAskPermission = true;
});
afterEach(() => jest.useRealTimers());

async function shown() {
  await act(async () => { jest.advanceTimersByTime(800); });
  return screen.queryByText('Ulaklar Hazır');
}

it('appears shortly after the week screen mounts while permission should be asked', async () => {
  await render(<NotifyAskModal blocked={false} />);
  expect(screen.queryByText('Ulaklar Hazır')).toBeNull();
  expect(await shown()).toBeTruthy();
});

it('stays hidden while another popup is open or when there is nothing to ask', async () => {
  await render(<NotifyAskModal blocked />);
  expect(await shown()).toBeNull();
  mockApi.shouldAskPermission = false;
  await render(<NotifyAskModal blocked={false} />);
  expect(await shown()).toBeNull();
});

it('"İzin ver" requests permission, then marks the explainer answered', async () => {
  await render(<NotifyAskModal blocked={false} />);
  await shown();
  await fireEvent.press(screen.getByLabelText(/^İzin ver/));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(mockApi.requestPermission).toHaveBeenCalledTimes(1);
  expect(mockApi.markAsked).toHaveBeenCalledTimes(1);
  expect(mockApi.requestPermission.mock.invocationCallOrder[0]).toBeLessThan(mockApi.markAsked.mock.invocationCallOrder[0]);
  expect(mockLog).toHaveBeenCalledWith('Ulaklar yola çıktı.', 'ferman');
  expect(screen.queryByText('Ulaklar Hazır')).toBeNull();
});

it('"Şimdi değil" only marks it answered', async () => {
  await render(<NotifyAskModal blocked={false} />);
  await shown();
  await fireEvent.press(screen.getByLabelText(/^Şimdi değil/));
  expect(mockApi.markAsked).toHaveBeenCalledTimes(1);
  expect(mockApi.requestPermission).not.toHaveBeenCalled();
  expect(mockLog).not.toHaveBeenCalled();
  expect(screen.queryByText('Ulaklar Hazır')).toBeNull();
});
