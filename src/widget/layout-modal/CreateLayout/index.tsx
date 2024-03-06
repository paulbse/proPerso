import { Component, createSignal } from 'solid-js';
import { Modal, Input, Button } from '../../../component';
import i18n from '../../../i18n';

export interface CreateLayoutModalProps {
  locale: string;
  currentSymbol: string;
  currentDate: string;
  currentPeriod: string;
  onCreateLayout: (layoutInfo: any) => void;
  onClose: () => void;
}

const CreateLayoutModal: Component<CreateLayoutModalProps> = (props) => {
  const [value, setValue] = createSignal('')

  const handleCreateLayout = () => {
    const layoutInfo = {
      name: value(),
      symbol: props.currentSymbol,
      date: props.currentDate,
      timeframe: props.currentPeriod
    };
    console.log('Layout Info:', layoutInfo); // Log the layoutInfo for debugging
    props.onCreateLayout(layoutInfo);
  };

  return (
    <Modal
      title={i18n('Create Layout Template', props.locale)}
      onClose={props.onClose}
      buttons={[
        {
          children: i18n('Create', props.locale),
          onClick: handleCreateLayout,
          class: 'create-button'
        }
      ]}
    >
  <Input
    class="klinecharts-pro-create-layout-modal-input"
    placeholder={i18n('Layout Name', props.locale)}
    value={value()}
    onChange={v => {
      const va = `${v}`
      setValue(va)
    }}/>
    </Modal>
  );
};

export default CreateLayoutModal;
