/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import Icon from '@ant-design/icons/lib/components/Icon';
import { Button, Col, Form, Modal, Row, Select } from 'antd';
import { AxiosError } from 'axios';
import { debounce, isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconDelete } from '../../../../assets/svg/ic-delete.svg';
import { ReactComponent as PlusIcon } from '../../../../assets/svg/plus-primary.svg';
import { PAGE_SIZE } from '../../../../constants/constants';
import { RELATIONSHIP_TYPE_OPTION } from '../../../../constants/Table.constants';
import { SearchIndex } from '../../../../enums/search.enum';
import { ConstraintType, Table } from '../../../../generated/entity/data/table';
import { searchQuery } from '../../../../rest/searchAPI';
import { getServiceNameQueryFilter } from '../../../../utils/ServiceUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import {
  SelectOptions,
  TableConstraintForm,
  TableConstraintModalProps,
} from './TableConstraintsModal.interface';

const TableConstraintsModal = ({
  tableDetails,
  constraint,
  onSave,
  onClose,
}: TableConstraintModalProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<{ constraint: TableConstraintForm[] }>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRelatedColumnLoading, setIsRelatedColumnLoading] =
    useState<boolean>(false);
  const [searchValue, setSearchValue] = useState<string>('');
  const [relatedColumns, setRelatedColumns] = useState<SelectOptions[]>([]);

  const tableColumnNameOptions = useMemo(
    () =>
      tableDetails?.columns.map((item) => ({
        label: item.name,
        value: item.name,
      })) ?? [],
    [tableDetails?.columns]
  );

  const getSearchResults = async (value: string) => {
    setIsRelatedColumnLoading(true);
    try {
      const data = await searchQuery({
        query: value,
        searchIndex: SearchIndex.TABLE,
        queryFilter: getServiceNameQueryFilter(
          tableDetails?.service?.name ?? ''
        ),
        pageNumber: 1,
        pageSize: PAGE_SIZE,
        includeDeleted: false,
      });
      const sources = data.hits.hits.map((hit) => hit._source);

      const allColumns = sources.reduce((acc: SelectOptions[], cv: Table) => {
        const columnOption = cv.columns
          .map((item) => ({
            label: item.fullyQualifiedName ?? '',
            value: item.fullyQualifiedName ?? '',
          }))
          .filter(Boolean);

        return [...acc, ...columnOption];
      }, []);

      setRelatedColumns(allColumns);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('server.entity-fetch-error', {
          entity: t('label.suggestion-lowercase-plural'),
        })
      );
    } finally {
      setIsRelatedColumnLoading(false);
    }
  };

  const debounceOnSearch = useCallback(debounce(getSearchResults, 300), []);

  const handleSearch = (value: string): void => {
    setSearchValue(value);
    debounceOnSearch(value);
  };

  const handleSubmit = async (obj: { constraint: TableConstraintForm[] }) => {
    try {
      setIsLoading(true);
      await form.validateFields();
      const constraintData = obj.constraint.map((item) => ({
        ...item,
        columns: [item.columns],
        referredColumns: [item.referredColumns],
        constraintType: ConstraintType.ForeignKey,
      }));

      await onSave(constraintData);
    } catch (_) {
      // Nothing here
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const filteredConstraints = !isEmpty(constraint)
      ? constraint
          ?.filter((item) => item.constraintType !== ConstraintType.PrimaryKey)
          .map((item) => ({
            columns: item.columns?.[0],
            relationshipType: item.relationshipType,
            referredColumns: item.referredColumns?.[0],
          }))
      : [
          {
            columns: '',
            relationshipType: '',
            referredColumns: '',
          },
        ];

    form.setFieldValue('constraint', filteredConstraints);
  }, [constraint]);

  useEffect(() => {
    getSearchResults(searchValue);
  }, []);

  return (
    <Modal
      centered
      destroyOnClose
      open
      closable={false}
      data-testid="table-constraint-modal"
      footer={[
        <Button
          disabled={isLoading}
          key="cancel-btn"
          type="link"
          onClick={onClose}>
          {t('label.cancel')}
        </Button>,
        <Button
          data-testid="save-btn"
          key="save-btn"
          loading={isLoading}
          type="primary"
          onClick={form.submit}>
          {t('label.save')}
        </Button>,
      ]}
      maskClosable={false}
      title={t(`label.${isEmpty(constraint) ? 'add' : 'update'}-entity`, {
        entity: t('label.table-constraint-plural'),
      })}
      width={600}
      onCancel={onClose}>
      <Form
        className="table-constraint-form"
        form={form}
        layout="vertical"
        onFinish={handleSubmit}>
        <Form.List name="constraint">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <Row gutter={8} key={key}>
                  <Col span={12}>
                    <Form.Item
                      className="w-full"
                      {...restField}
                      label={t('label.entity-name', {
                        entity: t('label.column'),
                      })}
                      name={[name, 'columns']}
                      rules={[
                        {
                          required: true,
                          message: t('label.field-required', {
                            field: t('label.entity-name', {
                              entity: t('label.column'),
                            }),
                          }),
                        },
                      ]}>
                      <Select
                        data-testid={`${key}-column-type-select`}
                        options={tableColumnNameOptions}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      {...restField}
                      label={t('label.entity-type-plural', {
                        entity: t('label.relationship'),
                      })}
                      name={[name, 'relationshipType']}
                      rules={[
                        {
                          required: true,
                          message: t('label.field-required', {
                            field: t('label.entity-type-plural', {
                              entity: t('label.relationship'),
                            }),
                          }),
                        },
                      ]}>
                      <Select
                        data-testid={`${key}-relationship-type-select`}
                        options={RELATIONSHIP_TYPE_OPTION}
                      />
                    </Form.Item>
                  </Col>

                  <Col span={23}>
                    <Form.Item
                      {...restField}
                      label={t('label.related-column')}
                      name={[name, 'referredColumns']}
                      rules={[
                        {
                          required: true,
                          message: t('label.field-required', {
                            field: t('label.related-column'),
                          }),
                        },
                      ]}>
                      <Select
                        showSearch
                        data-testid={`${key}-related-column-select`}
                        loading={isRelatedColumnLoading}
                        options={relatedColumns}
                        onClick={(e) => e.stopPropagation()}
                        onSearch={handleSearch}
                      />
                    </Form.Item>
                  </Col>

                  <Col span={1}>
                    <Button
                      data-testid={`${key}-delete-constraint-button`}
                      icon={
                        <Icon
                          className="align-middle"
                          component={IconDelete}
                          style={{ fontSize: '16px' }}
                        />
                      }
                      size="small"
                      type="text"
                      onClick={() => remove(name)}
                    />
                  </Col>
                </Row>
              ))}
              <Form.Item>
                <Button
                  className="text-primary d-flex items-center"
                  data-testid="add-constraint-button"
                  icon={<PlusIcon className="anticon" />}
                  size="small"
                  onClick={() => add()}>
                  {t('label.add')}
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
};

export default TableConstraintsModal;
