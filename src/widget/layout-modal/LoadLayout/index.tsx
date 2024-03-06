import { Component, createSignal, createResource, For } from "solid-js";
import { Modal, Input, Button } from "../../../component";
import i18n from "../../../i18n";

export interface LayoutInfo {
  name: string;
  symbol: string;
  timeframe: string;
  date: string;
  id: string;
}

export interface LayoutSearchModalProps {
  locale: string;
  layoutData: LayoutInfo[]; // Add this line
  onLayoutSelected: (layout: LayoutInfo) => void;
  onLayoutDelete: (layoutName: string) => void;
  onClose: () => void;
}

const LayoutSearchModal: Component<LayoutSearchModalProps> = (props) => {
  const [searchValue, setSearchValue] = createSignal("");
  const [layouts, setLayouts] = createSignal<LayoutInfo[]>(props.layoutData);
  const [selectedLayoutId, setSelectedLayoutId] = createSignal<string | null>(null);

  const searchLayouts = (query: string): LayoutInfo[] => {
    const lowerQuery = query.toLowerCase();
    // On filtre la liste des layouts pour retourner ceux qui correspondent à la recherche.
    return layouts().filter((layout) => {
      // Vérifier si la requête est contenue dans n'importe quel champ du layout.
      return Object.values(layout).some((value) =>
        value.toString().toLowerCase().includes(lowerQuery)
      );
    });
  };

  const filteredLayouts = () => {
    const lowerQuery = searchValue().toLowerCase();
    // Use props.layoutData directly as it's an array, not a function
    return props.layoutData.filter((layout: LayoutInfo) => {
      return Object.values(layout).some((value) =>
        value.toString().toLowerCase().includes(lowerQuery)
      );
    });
  };
  
  const confirmDelete = () => {
    const layoutToDeleteValue = layoutToDelete();
    // Check if layoutToDeleteValue is not null before accessing its properties
    if (layoutToDeleteValue) {
      props.onLayoutDelete(layoutToDeleteValue.id);
      setShowConfirmModal(false);
    }
  };
  

  const handleInputChange = (event: Event) => {
    const target = event.currentTarget as HTMLInputElement;
    setSearchValue(target.value);
  };

  const [showConfirmModal, setShowConfirmModal] = createSignal(false);
  const [layoutToDelete, setLayoutToDelete] = createSignal<LayoutInfo | null>(
    null
  );

  const handleLayoutDelete = (layout: LayoutInfo) => {
    setLayoutToDelete(layout);
    setShowConfirmModal(true);
  };

  const cancelDelete = () => {
    setShowConfirmModal(false);
  };

  return (
    <>
      <Modal
        title={i18n("Charger un Template", props.locale)}
        width={460}
        onClose={props.onClose}
      >
        <Input
          class="klinecharts-pro-layout-search-modal-input"
          placeholder={i18n("Rechecher", props.locale)}
          value={searchValue()}
          onChange={v => {
            const va = `${v}`
            setSearchValue(va)
          }}          suffix={
            <svg viewBox="0 0 1024 1024">
              <path d="M945.066667 898.133333l-189.866667-189.866666c55.466667-64 87.466667-149.333333 87.466667-241.066667 0-204.8-168.533333-373.333333-373.333334-373.333333S96 264.533333 96 469.333333 264.533333 842.666667 469.333333 842.666667c91.733333 0 174.933333-34.133333 241.066667-87.466667l189.866667 189.866667c6.4 6.4 14.933333 8.533333 23.466666 8.533333s17.066667-2.133333 23.466667-8.533333c8.533333-12.8 8.533333-34.133333-2.133333-46.933334zM469.333333 778.666667C298.666667 778.666667 160 640 160 469.333333S298.666667 160 469.333333 160 778.666667 298.666667 778.666667 469.333333 640 778.666667 469.333333 778.666667z" />
            </svg>
          }
        />
        <div class="klinecharts-pro-layout-search-modal-list">
          <For each={filteredLayouts()}>
            {(layout) => (
              <div
                class={`layout-item ${
                  selectedLayoutId() === layout.id ? "selected" : ""
                }`}
                onClick={() => {
                  props.onLayoutSelected(layout);
                  setSelectedLayoutId(layout.id);
                }}
              >
                <span class="layout-name">{layout.name}</span>
                <span class="layout-symbol">{layout.symbol}</span>
                <span class="layout-timeframe">{layout.timeframe}</span>
                <span class="layout-date">{layout.date}</span>
                <button
                  class="delete-icon"
                  onClick={(e) => {
                    e.stopPropagation(); // Empêche le clic de se propager à l'élément parent
                    handleLayoutDelete(layout);
                  }}
                >
                  x
                </button>
              </div>
            )}
          </For>
        </div>
      </Modal>
      {showConfirmModal() && (
        <Modal
          title={i18n("Confirm Delete", props.locale)}
          onClose={cancelDelete}
          buttons={[
            {
              children: i18n("Confirm", props.locale),
              onClick: confirmDelete,
              class: "confirm-button", // Apply styling for green color
            },
            {
              children: i18n("Cancel", props.locale),
              onClick: cancelDelete,
              class: "cancel-button", // Apply styling for red color
            },
          ]}
        >
          {i18n("Are you sure you want to delete this layout?", props.locale)}
        </Modal>
      )}
    </>
  );
};

export default LayoutSearchModal;
