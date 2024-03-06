import { Component, createSignal } from 'solid-js'
import { Modal, List, Checkbox, Input } from '../../component'
import i18n from '../../i18n'

type OnIndicatorChange = (params: { name: string; paneId: string; added: boolean }) => void;

export interface IndicatorModalProps {
  locale: string
  mainIndicators: string[]
  subIndicators: { [key: string]: string };
  onMainIndicatorChange: OnIndicatorChange
  onSubIndicatorChange: OnIndicatorChange
  onClose: () => void
  
}

const IndicatorModal: Component<IndicatorModalProps> = props => {
  const [searchValue, setSearchValue] = createSignal('');

  const mainIndicatorOptions = ['MA', 'EMA', 'SMA', 'BOLL', 'SAR', 'BBI'];
  const subIndicatorOptions = [
    'MA', 'EMA', 'VOL', 'MACD', 'BOLL', 'KDJ', 'RSI', 'BIAS', 'BRAR', 'CCI', 
    'DMI', 'CR', 'PSY', 'DMA', 'TRIX', 'OBV', 'VR', 'WR', 'MTM', 'EMV', 
    'SAR', 'SMA', 'ROC', 'PVT', 'BBI', 'AO'
  ];

  const filteredMainIndicators = () =>
    mainIndicatorOptions.filter(indicator =>
      indicator.toLowerCase().includes(searchValue().toLowerCase())
    );

  const filteredSubIndicators = () =>
    subIndicatorOptions.filter(indicator =>
      indicator.toLowerCase().includes(searchValue().toLowerCase())
    );

  return (
    <Modal
      title={i18n('indicator', props.locale)}
      width={400}
      onClose={props.onClose}>
      <Input
        placeholder="Search indicators"
        value={searchValue()}
        onChange={v => {
          const va = `${v}`
          setSearchValue(va)
        }}      />
      <List class="klinecharts-pro-indicator-modal-list">
        <li class="title">{i18n('main_indicator', props.locale)}</li>
        {filteredMainIndicators().map(name => {
          const checked = props.mainIndicators.includes(name);
          return (
            <li
              class="row"
              onClick={_ => {
                props.onMainIndicatorChange({ name, paneId: 'candle_pane', added: !checked });
              }}>
              <Checkbox checked={checked} label={i18n(name.toLowerCase(), props.locale)}/>
            </li>
          );
        })}
        <li class="title">{i18n('sub_indicator', props.locale)}</li>
        {filteredSubIndicators().map(name => {
          const checked = name in props.subIndicators;
          return (
            <li
              class="row"
              onClick={_ => {
                props.onSubIndicatorChange({ name, paneId: props.subIndicators[name] ?? '', added: !checked });
              }}>
              <Checkbox checked={checked} label={i18n(name.toLowerCase(), props.locale)}/>
            </li>
          );
        })}
      </List>
    </Modal>
  )
}

export default IndicatorModal
