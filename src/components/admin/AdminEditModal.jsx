import { useState } from 'react'
import { calculateAssetBreakdown } from '../../utils/calculateAssets'
import {
  JOB_LABELS, BADGE_NAMES, BADGE_LABELS,
  REAL_ESTATE_LABELS, ESTATE_IMAGES,
  STOCK_LABELS, STOCK_IMAGES,
} from '../../constants/gameData'
import NumberInputModal from '../NumberInputModal'
import JobEditModal from './JobEditModal'
import BadgeEditModal from './BadgeEditModal'
import RealEstateEditModal from './RealEstateEditModal'
import StockEditModal from './StockEditModal'
import styles from './AdminEditModal.module.css'

function AssetSummaryList({ labels, images, values, folder, unit, testIdPrefix }) {
  const holdings = Object.keys(labels).filter(key => Number(values?.[key] ?? 0) > 0)

  if (holdings.length === 0) {
    return <span className={styles.emptyAsset}>미보유</span>
  }

  return (
    <div className={styles.assetList}>
      {holdings.map(key => {
        const amount = Number(values[key] ?? 0)
        return (
          <div key={key} className={styles.assetRow} data-testid={`${testIdPrefix}-${key}`}>
            <img
              src={`/badges/${folder}/${images[key]}.png`}
              alt={labels[key]}
              className={styles.assetIcon}
            />
            <span className={styles.assetName}>{labels[key]}</span>
            <span className={styles.assetAmount}>{amount}{unit}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function AdminEditModal({ player, prices, onSave = () => {}, onClose, readOnly = false }) {
  const [editingField, setEditingField] = useState(null)
  const { gameState } = player
  const { totalAssets } = calculateAssetBreakdown(gameState, prices)
  const earnedBadges = BADGE_NAMES.filter((_, i) => gameState.badges[i])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onClose}>‹ 뒤로</button>
        <div className={styles.profileHeader}>
          <img src={`/characters/${player.character}.png`} alt={player.character} className={styles.avatar} />
          <span className={styles.name}>{player.name}</span>
        </div>
      </div>

      <div className={styles.columns}>
        <div className={styles.card}>
          <div className={styles.field}>
            <div className={styles.fieldHeader}>
              <span className={styles.fieldLabel}>직업</span>
              {!readOnly && (
                <button type="button" data-testid="edit-job" className={styles.editBtn} onClick={() => setEditingField('job')}>수정</button>
              )}
            </div>
            <span className={styles.fieldValue}>{gameState.job ? JOB_LABELS[gameState.job] : '미입력'}</span>
          </div>

          <div className={styles.field}>
            <div className={styles.fieldHeader}>
              <span className={styles.fieldLabel}>성공카드</span>
              {!readOnly && (
                <button type="button" data-testid="edit-badges" className={styles.editBtn} onClick={() => setEditingField('badges')}>수정</button>
              )}
            </div>
            <div className={styles.chipRow}>
              {earnedBadges.length === 0 && <span className={styles.fieldValue}>미입력</span>}
              {earnedBadges.map(name => <span key={name} className={styles.chip}>{BADGE_LABELS[name]}</span>)}
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.fieldHeader}>
              <span className={styles.fieldLabel}>현금</span>
              {!readOnly && (
                <button type="button" data-testid="edit-cash" className={styles.editBtn} onClick={() => setEditingField('cash')}>수정</button>
              )}
            </div>
            <span className={styles.fieldValue}>{(gameState.cash ?? 0).toLocaleString()}원</span>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.field}>
            <div className={styles.fieldHeader}>
              <span className={styles.fieldLabel}>부동산</span>
              {!readOnly && (
                <button type="button" data-testid="edit-realEstate" className={styles.editBtn} onClick={() => setEditingField('realEstate')}>수정</button>
              )}
            </div>
            <AssetSummaryList
              labels={REAL_ESTATE_LABELS}
              images={ESTATE_IMAGES}
              values={gameState.realEstate}
              folder="estate"
              unit="개"
              testIdPrefix="admin-real-estate-holding"
            />
          </div>

          <div className={styles.field}>
            <div className={styles.fieldHeader}>
              <span className={styles.fieldLabel}>주식</span>
              {!readOnly && (
                <button type="button" data-testid="edit-stocks" className={styles.editBtn} onClick={() => setEditingField('stocks')}>수정</button>
              )}
            </div>
            <AssetSummaryList
              labels={STOCK_LABELS}
              images={STOCK_IMAGES}
              values={gameState.stocks}
              folder="stock"
              unit="주"
              testIdPrefix="admin-stock-holding"
            />
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        <span className={styles.footerLabel}>총 자산</span>
        <span className={styles.footerValue}>{totalAssets.toLocaleString()}원</span>
      </div>

      {editingField === 'job' && (
        <JobEditModal
          value={gameState.job}
          onChange={val => { onSave('job', val); setEditingField(null) }}
          onClose={() => setEditingField(null)}
        />
      )}
      {editingField === 'badges' && (
        <BadgeEditModal
          badges={gameState.badges}
          onToggle={i => {
            const badges = [...gameState.badges]
            badges[i] = !badges[i]
            onSave('badges', badges)
          }}
          onClose={() => setEditingField(null)}
        />
      )}
      {editingField === 'cash' && (
        <NumberInputModal
          title="현금 수정"
          initialValue={gameState.cash ?? 0}
          unit="원"
          onConfirm={val => { onSave('cash', val); setEditingField(null) }}
          onClose={() => setEditingField(null)}
        />
      )}
      {editingField === 'realEstate' && (
        <RealEstateEditModal
          values={gameState.realEstate}
          onChange={val => onSave('realEstate', val)}
          onClose={() => setEditingField(null)}
        />
      )}
      {editingField === 'stocks' && (
        <StockEditModal
          values={gameState.stocks}
          onChange={val => onSave('stocks', val)}
          onClose={() => setEditingField(null)}
        />
      )}
    </div>
  )
}
