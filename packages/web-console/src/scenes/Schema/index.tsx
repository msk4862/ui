/*******************************************************************************
 *     ___                  _   ____  ____
 *    / _ \ _   _  ___  ___| |_|  _ \| __ )
 *   | | | | | | |/ _ \/ __| __| | | |  _ \
 *   | |_| | |_| |  __/\__ \ |_| |_| | |_) |
 *    \__\_\\__,_|\___||___/\__|____/|____/
 *
 *  Copyright (c) 2014-2019 Appsicle
 *  Copyright (c) 2019-2022 QuestDB
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 ******************************************************************************/

import React, {
  CSSProperties,
  forwardRef,
  Ref,
  useRef,
  useCallback,
  useEffect,
  useState,
} from "react"
import { useDispatch, useSelector } from "react-redux"
import { from, combineLatest, of } from "rxjs"
import { delay, startWith } from "rxjs/operators"
import styled, { css } from "styled-components"
import {
  Database2,
  Loader3,
  Refresh,
  ArrowLeftCircle,
  AddCircle,
} from "@styled-icons/remix-line"

import {
  PaneContent,
  PaneWrapper,
  PopperHover,
  PaneMenu,
  SecondaryButton,
  spinAnimation,
  Text,
  Tooltip,
  VirtualList,
} from "../../components"
import { actions, selectors } from "../../store"
import { color, ErrorResult } from "../../utils"
import * as QuestDB from "../../utils/questdb"
import Table from "./Table"
import LoadingError from "./LoadingError"
import { BusEvent } from "../../consts"
import { StoreKey } from "../../utils/localStorage/types"
import { useLocalStorage } from "../../providers/LocalStorageProvider"
import { Box } from "../../components/Box"
import { Dialog as TableSchemaDialog } from "../../components/TableSchemaDialog/dialog"
import { SchemaFormValues } from "components/TableSchemaDialog/types"
import { formatTableSchemaQuery } from "../../utils/formatTableSchemaQuery"
import { useEditor } from "../../providers"

type Props = Readonly<{
  hideMenu?: boolean
  style?: CSSProperties
}>

const loadingStyles = css`
  display: flex;
  justify-content: center;
`

const Wrapper = styled(PaneWrapper)`
  overflow-x: auto;
  height: 100%;
`

const Menu = styled(PaneMenu)`
  justify-content: space-between;
`

const Header = styled(Text)`
  display: flex;
  align-items: center;
`

const Content = styled(PaneContent)<{
  _loading: boolean
}>`
  display: block;
  font-family: ${({ theme }) => theme.fontMonospace};
  overflow: auto;
  ${({ _loading }) => _loading && loadingStyles};
`

const DatabaseIcon = styled(Database2)`
  margin-right: 1rem;
`

const HideSchemaButton = styled(SecondaryButton)`
  margin-left: 1rem;
`

const Loader = styled(Loader3)`
  margin-left: 1rem;
  align-self: center;
  color: ${color("foreground")};
  ${spinAnimation};
`

const FlexSpacer = styled.div`
  flex: 1;
`

const Schema = ({
  innerRef,
  ...rest
}: Props & { innerRef: Ref<HTMLDivElement> }) => {
  const [quest] = useState(new QuestDB.Client())
  const [loading, setLoading] = useState(false)
  const [loadingError, setLoadingError] = useState<ErrorResult | null>(null)
  const errorRef = useRef<ErrorResult | null>(null)
  const [tables, setTables] = useState<QuestDB.Table[]>()
  const [opened, setOpened] = useState<string>()
  const [refresh, setRefresh] = useState(Date.now())
  const [isScrolling, setIsScrolling] = useState(false)
  const [addTableDialogOpen, setAddTableDialogOpen] = useState<
    string | undefined
  >(undefined)
  const { readOnly } = useSelector(selectors.console.getConfig)
  const { updateSettings } = useLocalStorage()
  const dispatch = useDispatch()
  const { appendQuery } = useEditor()

  const handleChange = useCallback((name: string) => {
    setOpened(name)
  }, [])

  const handleScrollingStateChange = useCallback(
    (isScrolling) => {
      setIsScrolling(isScrolling)
    },
    [setIsScrolling],
  )

  const listItemContent = useCallback(
    (index: number) => {
      if (tables) {
        const table = tables[index]

        return (
          <Table
            designatedTimestamp={table.designatedTimestamp}
            expanded={table.name === opened}
            isScrolling={isScrolling}
            key={table.name}
            name={table.name}
            onChange={handleChange}
            partitionBy={table.partitionBy}
            refresh={refresh}
            walEnabled={table.walEnabled}
          />
        )
      }
    },
    [handleChange, isScrolling, opened, refresh, tables],
  )

  const fetchTables = useCallback(() => {
    setLoading(true)
    combineLatest(
      from(quest.showTables()).pipe(startWith(null)),
      of(true).pipe(delay(1000), startWith(false)),
    ).subscribe(
      ([response, loading]) => {
        if (response && response.type === QuestDB.Type.DQL) {
          setLoadingError(null)
          errorRef.current = null
          setTables(response.data)
          dispatch(actions.query.setTables(response.data))
          setRefresh(Date.now())
        } else {
          setLoading(false)
        }
      },
      (error) => {
        setLoadingError(error)
      },
      () => {
        setLoading(false)
      },
    )
  }, [quest])

  const handleHideSchemaClick = useCallback(() => {
    updateSettings(StoreKey.RESULTS_SPLITTER_BASIS, 0)
  }, [])

  const handleAddTableSchema = (values: SchemaFormValues) => {
    const { name, partitionBy, timestamp, schemaColumns, walEnabled } = values
    const tableSchemaQuery = formatTableSchemaQuery({
      name,
      partitionBy,
      timestamp,
      walEnabled: walEnabled === "true",
      schemaColumns: schemaColumns.map((column) => ({
        column: column.name,
        type: column.type,
      })),
    })
    appendQuery(tableSchemaQuery, { appendAt: "end" })
    dispatch(actions.query.toggleRunning())
  }

  useEffect(() => {
    void fetchTables()

    window.bus.on(BusEvent.MSG_QUERY_SCHEMA, () => {
      void fetchTables()
    })

    window.bus.on(
      BusEvent.MSG_CONNECTION_ERROR,
      (_event, error: ErrorResult) => {
        errorRef.current = error
        setLoadingError(error)
      },
    )

    window.bus.on(BusEvent.MSG_CONNECTION_OK, () => {
      // The connection has been re-established, as we have an error in memory
      if (errorRef.current) {
        void fetchTables()
      }
    })
  }, [errorRef, fetchTables])

  return (
    <Wrapper ref={innerRef} {...rest}>
      <Menu>
        <Header color="foreground">
          <DatabaseIcon size="18px" />
          Tables
        </Header>

        <div style={{ display: "flex" }}>
          {readOnly === false && tables && (
            <Box align="center" gap="1rem">
              <TableSchemaDialog
                action="add"
                isEditLocked={false}
                hasWalSetting={true}
                walEnabled={false}
                name=""
                partitionBy="NONE"
                schema={[]}
                tables={tables}
                timestamp=""
                onOpenChange={(open) => setAddTableDialogOpen(open)}
                open={addTableDialogOpen !== undefined}
                onSchemaChange={handleAddTableSchema}
                trigger={
                  <SecondaryButton onClick={() => setAddTableDialogOpen("add")}>
                    <AddCircle size="18px" />
                    <span>Create</span>
                  </SecondaryButton>
                }
                ctaText="Create"
              />
              <PopperHover
                delay={350}
                placement="bottom"
                trigger={
                  <SecondaryButton onClick={fetchTables}>
                    <Refresh size="18px" />
                  </SecondaryButton>
                }
              >
                <Tooltip>Refresh</Tooltip>
              </PopperHover>
            </Box>
          )}
          <PopperHover
            delay={350}
            placement="bottom"
            trigger={
              <HideSchemaButton onClick={handleHideSchemaClick}>
                <ArrowLeftCircle size="18px" />
              </HideSchemaButton>
            }
          >
            <Tooltip>Hide tables</Tooltip>
          </PopperHover>
        </div>
      </Menu>

      <Content _loading={loading}>
        {loading ? (
          <Loader size="48px" />
        ) : loadingError ? (
          <LoadingError error={loadingError} />
        ) : (
          <VirtualList
            isScrolling={handleScrollingStateChange}
            itemContent={listItemContent}
            totalCount={tables?.length}
          />
        )}
        {!loading && <FlexSpacer />}
      </Content>
    </Wrapper>
  )
}

const SchemaWithRef = (props: Props, ref: Ref<HTMLDivElement>) => (
  <Schema {...props} innerRef={ref} />
)

export default forwardRef(SchemaWithRef)
