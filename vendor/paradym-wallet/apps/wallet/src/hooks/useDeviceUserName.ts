import { useMMKVString } from 'react-native-mmkv'
import { mmkv } from '../storage/mmkv'

export function useDeviceUserName() {
  return useMMKVString('deviceUserName', mmkv)
}
